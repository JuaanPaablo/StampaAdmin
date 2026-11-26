'use server';

import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { cleanGiftCardNote, cleanRequestId, parseGiftCardAmount, validateGiftCardLoad, walletFeatureError } from '@/lib/domain/wallet-cards';
import { syncGiftCardWallet } from '@/lib/wallet/sync';
import { friendlyError } from '@/components/offers/offer-form';
import { giftQrSvg } from '@/components/giftcards/qr';

export interface GiftActionResult { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }

export interface SoldGiftCard { id: string; code: string; amountCents: number; customerName?: string; qrSvg: string }
export type SellGiftResult = GiftActionResult & { sold?: SoldGiftCard };

export interface CustomerOption { id: string; name: string; contact: string }

const NO_PERMISSION = { ok: false, error: 'Solo el dueño o un gerente pueden vender, recargar o anular gift cards.' } as const;
const cleanId = (v: FormDataEntryValue | null) => String(v ?? '').trim().slice(0, 64);

async function managerContext() {
  const ctx = await getContext();
  return hasRole(ctx, ['owner', 'manager']) ? ctx : null;
}

/**
 * Actualiza el Wallet de la gift card (Google y, si tiene cliente, Apple) sin frenar la operación: espera como máximo
 * 2,5 s (como Caja) y syncGiftCardWallet nunca lanza.
 */
async function syncQuietly(businessId: string, giftCardId: string, notify = false) {
  const job = syncGiftCardWallet(businessId, giftCardId, { notify }).catch(() => undefined);
  await Promise.race([job, new Promise<void>((r) => setTimeout(r, 2500))]);
}

/** Busca clientes del negocio por nombre o contacto para asignarles una gift card (máximo 8 resultados). */
export async function searchGiftCustomersAction(q: string): Promise<CustomerOption[]> {
  const ctx = await managerContext();
  if (!ctx) return [];
  const search = String(q ?? '').trim().slice(0, 80);
  if (search.length < 2) return [];
  const rows = await ctx.repo.listCustomers(ctx.business.id, { search, sort: 'nombre' }).catch(() => []);
  return rows.slice(0, 8).map((c) => ({ id: c.id, name: c.name, contact: c.contact }));
}

/** Vende una gift card. Devuelve el código y su QR para entregárselo al cliente. */
export async function sellGiftCardAction(fd: FormData): Promise<SellGiftResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const planErr = walletFeatureError(ctx.business.plan, 'giftCards');
  if (planErr) return { ok: false, error: planErr };
  const requestId = cleanRequestId(fd.get('requestId'));
  const amount = parseGiftCardAmount(String(fd.get('amount') ?? ''));
  if (!amount.ok) return { ok: false, fieldErrors: { amount: amount.error } };
  const loadErr = validateGiftCardLoad(amount.cents);
  if (loadErr) return { ok: false, fieldErrors: { amount: loadErr } };
  const customerId = cleanId(fd.get('customerId')) || undefined;
  const note = cleanGiftCardNote(String(fd.get('note') ?? ''));
  try {
    // Con el mismo requestId (doble toque, reintento) el repo devuelve la venta ya hecha: no se crea otra tarjeta.
    const { giftCard, movement } = await ctx.repo.issueGiftCard(ctx.business.id, {
      amountCents: amount.cents, staffId: ctx.staff.id, customerId, locationId: ctx.staff.locationId || undefined, note, requestId
    });
    const customerName = customerId ? String(fd.get('customerName') ?? '').slice(0, 80) || undefined : undefined;
    const [qrSvg] = await Promise.all([giftQrSvg(giftCard.code), syncQuietly(ctx.business.id, giftCard.id)]);
    revalidatePath('/panel/gift-cards');
    return { ok: true, message: 'Gift card vendida.', sold: { id: giftCard.id, code: giftCard.code, amountCents: movement.amountCents, customerName, qrSvg } };
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos vender la gift card. Inténtalo de nuevo.') };
  }
}

/** Recarga saldo a una gift card activa. */
export async function topupGiftCardAction(fd: FormData): Promise<GiftActionResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const planErr = walletFeatureError(ctx.business.plan, 'giftCards');
  if (planErr) return { ok: false, error: planErr };
  const id = cleanId(fd.get('id'));
  const card = id ? await ctx.repo.getGiftCard(ctx.business.id, id) : null;
  if (!card) return { ok: false, error: 'No encontramos esa gift card.' };
  const requestId = cleanRequestId(fd.get('requestId'));
  const done = requestId ? await ctx.repo.findGiftCardResultByRequest(ctx.business.id, requestId) : null;
  if (done && done.giftCard.id === card.id && done.movement.kind === 'topup') return { ok: true, message: 'Recarga hecha.' };
  if (card.status !== 'active') return { ok: false, error: 'Esta gift card está anulada.' };
  const amount = parseGiftCardAmount(String(fd.get('amount') ?? ''));
  if (!amount.ok) return { ok: false, fieldErrors: { amount: amount.error } };
  const loadErr = validateGiftCardLoad(amount.cents, card.balanceCents);
  if (loadErr) return { ok: false, fieldErrors: { amount: loadErr } };
  try {
    await ctx.repo.topupGiftCard(ctx.business.id, card.id, amount.cents, ctx.staff.id, {
      locationId: ctx.staff.locationId || undefined, note: cleanGiftCardNote(String(fd.get('note') ?? '')), requestId
    });
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos recargar la gift card. Inténtalo de nuevo.') };
  }
  await syncQuietly(ctx.business.id, card.id, true);
  revalidatePath('/panel/gift-cards');
  revalidatePath(`/panel/gift-cards/${card.id}`);
  return { ok: true, message: 'Recarga hecha.' };
}

/** Anula una gift card: el saldo queda en 0 y ya no se puede usar. */
export async function voidGiftCardAction(fd: FormData): Promise<GiftActionResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const id = cleanId(fd.get('id'));
  const card = id ? await ctx.repo.getGiftCard(ctx.business.id, id) : null;
  if (!card) return { ok: false, error: 'No encontramos esa gift card.' };
  if (card.status !== 'active') return { ok: true, message: 'La gift card ya estaba anulada.' };
  try {
    await ctx.repo.voidGiftCard(ctx.business.id, card.id, ctx.staff.id, cleanGiftCardNote(String(fd.get('note') ?? '')), cleanRequestId(fd.get('requestId')));
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos anular la gift card. Inténtalo de nuevo.') };
  }
  await syncQuietly(ctx.business.id, card.id);
  revalidatePath('/panel/gift-cards');
  revalidatePath(`/panel/gift-cards/${card.id}`);
  return { ok: true, message: 'Gift card anulada.' };
}
