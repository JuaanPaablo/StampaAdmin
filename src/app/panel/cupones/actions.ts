'use server';

import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { walletFeatureError } from '@/lib/domain/wallet-cards';
import { syncOfferBatch, type OfferBatchResult } from '@/lib/wallet/notify';
import { friendlyError, offerInputFromForm, readOfferForm } from '@/components/offers/offer-form';

export interface OfferActionResult { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; offerId?: string; query?: string }

const NO_PERMISSION: OfferActionResult = { ok: false, error: 'Solo el dueño o un gerente pueden manejar los cupones.' };
const cleanId = (v: FormDataEntryValue | null) => String(v ?? '').trim().slice(0, 64);

async function managerContext() {
  const ctx = await getContext();
  return hasRole(ctx, ['owner', 'manager']) ? ctx : null;
}

/** Crea un cupón (queda como borrador). */
export async function createOfferAction(fd: FormData): Promise<OfferActionResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const planErr = walletFeatureError(ctx.business.plan, 'offers');
  if (planErr) return { ok: false, error: planErr };
  const parsed = offerInputFromForm(readOfferForm(fd));
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors as Record<string, string> };
  try {
    const offer = await ctx.repo.createOffer(ctx.business.id, parsed.input, ctx.staff.id);
    revalidatePath('/panel/cupones');
    return { ok: true, message: 'Cupón guardado como borrador.', offerId: offer.id };
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos guardar el cupón. Inténtalo de nuevo.') };
  }
}

/** Edita un borrador. */
export async function updateOfferAction(fd: FormData): Promise<OfferActionResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const planErr = walletFeatureError(ctx.business.plan, 'offers');
  if (planErr) return { ok: false, error: planErr };
  const id = cleanId(fd.get('id'));
  if (!id) return { ok: false, error: 'No encontramos ese cupón.' };
  const parsed = offerInputFromForm(readOfferForm(fd));
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors as Record<string, string> };
  try {
    const offer = await ctx.repo.updateOffer(ctx.business.id, id, parsed.input, ctx.staff.id);
    revalidatePath('/panel/cupones');
    revalidatePath(`/panel/cupones/${offer.id}`);
    return { ok: true, message: 'Cambios guardados.', offerId: offer.id };
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos guardar los cambios. Inténtalo de nuevo.') };
  }
}

/**
 * Envía el cupón a todos los clientes (cuenta como una campaña del mes). El Wallet (pases y avisos) NO se hace aquí:
 * la página del cupón abre `?wallet=envio` y OfferWalletSync llama a syncOfferBatchAction por tandas, así ninguna
 * petición hace el trabajo de cientos de clientes. Si se corta, "Volver a sincronizar" lo retoma sin avisar dos veces.
 */
export async function sendOfferAction(fd: FormData): Promise<OfferActionResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const planErr = walletFeatureError(ctx.business.plan, 'offers');
  if (planErr) return { ok: false, error: planErr };
  const id = cleanId(fd.get('id'));
  if (!id) return { ok: false, error: 'No encontramos ese cupón.' };
  let sent: { offerId: string; customerIds: string[] };
  try {
    const r = await ctx.repo.sendOffer(ctx.business.id, id, ctx.staff.id);
    sent = { offerId: r.offer.id, customerIds: r.customerIds };
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos enviar el cupón. Inténtalo de nuevo.') };
  }
  revalidatePath('/panel/cupones');
  revalidatePath(`/panel/cupones/${sent.offerId}`);
  return { ok: true, offerId: sent.offerId, query: 'wallet=envio', message: 'Cupón enviado. Ahora actualizamos los celulares de tus clientes…' };
}

/** Termina un cupón: deja de poder canjearse y desaparece de las tarjetas. */
export async function endOfferAction(fd: FormData): Promise<OfferActionResult> {
  const ctx = await managerContext();
  if (!ctx) return NO_PERMISSION;
  const id = cleanId(fd.get('id'));
  if (!id) return { ok: false, error: 'No encontramos ese cupón.' };
  try {
    await ctx.repo.endOffer(ctx.business.id, id, ctx.staff.id);
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'No pudimos terminar el cupón. Inténtalo de nuevo.') };
  }
  revalidatePath('/panel/cupones');
  revalidatePath(`/panel/cupones/${id}`);
  // Los pases de los cupones sin usar se actualizan por tandas desde la página (?wallet=fin), sin avisos.
  return { ok: true, message: 'Cupón terminado. Ya no se puede usar.', offerId: id, query: 'wallet=fin' };
}

export type OfferBatchActionResult = { ok: true; batch: OfferBatchResult } | { ok: false; error: string };

/**
 * Una tanda del Wallet de un cupón (OfferWalletSync la llama en bucle). 'send' solo para cupones enviados; 'end' para
 * terminados o vencidos. Idempotente: se puede repetir (no avisa dos veces al mismo cliente).
 */
export async function syncOfferBatchAction(offerId: string, mode: 'send' | 'end', cursor: string | null): Promise<OfferBatchActionResult> {
  const ctx = await managerContext();
  if (!ctx) return { ok: false, error: NO_PERMISSION.error! };
  const id = String(offerId ?? '').trim().slice(0, 64);
  const after = cursor ? String(cursor).trim().slice(0, 80) : undefined;
  if (!id || (mode !== 'send' && mode !== 'end')) return { ok: false, error: 'No encontramos ese cupón.' };
  const offer = await ctx.repo.getOffer(ctx.business.id, id);
  if (!offer || offer.status === 'draft') return { ok: false, error: 'No encontramos ese cupón.' };
  try {
    return { ok: true, batch: await syncOfferBatch(ctx.business.id, id, offer.status === 'ended' ? 'end' : mode, after) };
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'Se cortó la conexión. Vuelve a intentarlo: seguimos donde quedamos.') };
  }
}
