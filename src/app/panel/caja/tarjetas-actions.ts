'use server';

import { revalidatePath } from 'next/cache';
import { getContext, type PanelContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { features } from '@/lib/plans';
import {
  cleanRequestId, customerOfferRedeemError, formatCents, maskGiftCardCode, offerStatusLabel, parseGiftCardAmount, validateGiftCardCharge, validateGiftCardLoad, WALLET_MANAGER_ONLY
} from '@/lib/domain/wallet-cards';
import { syncCustomerOfferWallet, syncGiftCardWallet } from '@/lib/wallet/sync';
import type { CustomerOfferDetail, GiftCard } from '@/lib/contracts';
import { parseCounterCode } from '@/components/caja/counter-code';
import { friendlyError } from '@/components/offers/offer-form';
import { ecDate, ecDateTime } from '@/components/customer/wallet-model';
import type { CounterState, CouponView, GiftView } from '@/components/caja/types';

/**
 * Caja → "Cupón o gift card". Una sola acción con `intent` (lookup | redeem | charge | topup) para que la pantalla
 * mantenga en un solo estado lo que está mirando y el resultado de la última operación.
 * Los permisos y el plan los valida el repo (mensajes en español); aquí solo se ocultan atajos obvios.
 */

const NOT_FOUND_COUPON = 'No encontramos ese cupón en este negocio. Puede ser de otro negocio o ya no existir.';
const NOT_FOUND_GIFT = 'No encontramos esa gift card en este negocio. Revisa el código o si es de otro negocio.';
const NETWORK = 'No se pudo completar. Revisa la conexión e intenta de nuevo.';

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

/** Errores de reglas del repo (español) pasan tal cual; los técnicos (base de datos, red) → mensaje genérico. */
const errMsg = (e: unknown) => friendlyError(e, NETWORK);

/** Actualiza los pases sin hacer esperar a la caja más de 2,5 s (las funciones de sync nunca lanzan). */
async function syncSoon(job: Promise<void>): Promise<void> {
  await Promise.race([job, new Promise<void>((r) => setTimeout(r, 2500))]);
}

function couponView(d: CustomerOfferDetail): CouponView {
  const problem = customerOfferRedeemError(d, d.offer);
  return {
    kind: 'coupon',
    id: d.id,
    customerName: d.customerName,
    title: d.offer.title,
    description: d.offer.description,
    terms: d.offer.terms,
    validity: `Válido del ${ecDate(d.offer.startsAt)} al ${ecDate(d.offer.endsAt)}`,
    statusLabel: d.redeemedAt ? 'Ya usado' : offerStatusLabel(d.offer),
    problem: d.redeemedAt ? `Este cupón ya se usó el ${ecDateTime(d.redeemedAt)}.` : problem,
    redeemedAt: d.redeemedAt
  };
}

async function giftView(ctx: PanelContext, g: GiftCard): Promise<GiftView> {
  const [movements, detail] = await Promise.all([
    ctx.repo.listGiftCardMovements(ctx.business.id, g.id, 5),
    g.customerId ? ctx.repo.getCustomerDetail(ctx.business.id, g.customerId).catch(() => null) : Promise.resolve(null)
  ]);
  return {
    kind: 'gift',
    id: g.id,
    maskedCode: maskGiftCardCode(g.code),
    customerName: detail?.customer.name,
    balanceCents: g.balanceCents,
    status: g.status,
    movements: movements.map((m) => ({ id: m.id, kind: m.kind, amountCents: m.amountCents, balanceAfterCents: m.balanceAfterCents, at: ecDateTime(m.createdAt), note: m.note }))
  };
}

function revalidate() {
  revalidatePath('/panel/caja');
  revalidatePath('/panel/control');
  revalidatePath('/panel/cupones');
  revalidatePath('/panel/gift-cards');
}

export async function counterAction(prev: CounterState, fd: FormData): Promise<CounterState> {
  const ctx = await getContext();
  const seq = (prev?.seq ?? 0) + 1;
  const businessId = ctx.business.id;
  const intent = text(fd, 'intent');

  try {
    if (intent === 'lookup') {
      const parsed = parseCounterCode(text(fd, 'code'));
      if (parsed.kind === 'invalid') return { seq, error: parsed.error, field: 'code' };
      if (parsed.kind === 'coupon') {
        const d = await ctx.repo.findCustomerOffer(businessId, parsed.id);
        if (!d) return { seq, error: NOT_FOUND_COUPON, field: 'code' };
        return { seq, item: couponView(d) };
      }
      const g = await ctx.repo.findGiftCardByCode(businessId, parsed.code);
      if (!g) return { seq, error: NOT_FOUND_GIFT, field: 'code' };
      return { seq, item: await giftView(ctx, g) };
    }

    const id = text(fd, 'id').trim().slice(0, 80);
    if (!id) return { seq, error: 'Vuelve a escanear el código.', field: 'code' };

    if (intent === 'redeem') {
      const before = await ctx.repo.findCustomerOffer(businessId, id);
      if (!before) return { seq, error: NOT_FOUND_COUPON, field: 'code' };
      try {
        await ctx.repo.redeemCustomerOffer(businessId, id, ctx.staff.id, ctx.staff.locationId);
      } catch (e) {
        const now = await ctx.repo.findCustomerOffer(businessId, id);
        return { seq, item: now ? couponView(now) : couponView(before), error: errMsg(e) };
      }
      const after = await ctx.repo.findCustomerOffer(businessId, id);
      await syncSoon(syncCustomerOfferWallet(businessId, id));
      revalidate();
      return { seq, item: after ? couponView(after) : couponView(before), message: `Cupón canjeado: ${before.offer.title} para ${before.customerName}.` };
    }

    if (intent === 'charge' || intent === 'topup') {
      const field = intent;
      const g = await ctx.repo.getGiftCard(businessId, id);
      if (!g) return { seq, error: NOT_FOUND_GIFT, field: 'code' };
      const current = await giftView(ctx, g);
      // Idempotencia: doble toque o reintento con el mismo requestId → se muestra el resultado ya registrado.
      const requestId = cleanRequestId(text(fd, 'requestId'));
      const done = requestId ? await ctx.repo.findGiftCardResultByRequest(businessId, requestId) : null;
      if (done && done.giftCard.id === g.id && done.movement.kind === intent) {
        const cents = Math.abs(done.movement.amountCents);
        return { seq, item: current, message: `${intent === 'charge' ? 'Cobro' : 'Recarga'} de ${formatCents(cents)} listo. Saldo: ${formatCents(done.giftCard.balanceCents)}.` };
      }
      const amount = parseGiftCardAmount(text(fd, 'amount'));
      if (!amount.ok) return { seq, item: current, error: amount.error, field };

      if (intent === 'charge') {
        const bad = validateGiftCardCharge(amount.cents, g);
        if (bad) return { seq, item: current, error: bad, field };
        try {
          const r = await ctx.repo.chargeGiftCard(businessId, g.id, amount.cents, ctx.staff.id, { locationId: ctx.staff.locationId, requestId });
          await syncSoon(syncGiftCardWallet(businessId, g.id));
          revalidate();
          return { seq, item: await giftView(ctx, r.giftCard), message: `Cobro de ${formatCents(amount.cents)} listo. Nuevo saldo: ${formatCents(r.giftCard.balanceCents)}.` };
        } catch (e) {
          return { seq, item: current, error: errMsg(e), field };
        }
      }

      if (!hasRole(ctx, ['owner', 'manager'])) return { seq, item: current, error: WALLET_MANAGER_ONLY, field };
      if (!features(ctx.business.plan).giftCards) return { seq, item: current, error: 'Tu plan no incluye vender ni recargar gift cards.', field };
      const bad = g.status !== 'active' ? 'Esta gift card está anulada.' : validateGiftCardLoad(amount.cents, g.balanceCents);
      if (bad) return { seq, item: current, error: bad, field };
      try {
        const r = await ctx.repo.topupGiftCard(businessId, g.id, amount.cents, ctx.staff.id, { locationId: ctx.staff.locationId, requestId });
        await syncSoon(syncGiftCardWallet(businessId, g.id, { notify: true }));
        revalidate();
        return { seq, item: await giftView(ctx, r.giftCard), message: `Recarga de ${formatCents(amount.cents)} lista. Nuevo saldo: ${formatCents(r.giftCard.balanceCents)}.` };
      } catch (e) {
        return { seq, item: current, error: errMsg(e), field };
      }
    }

    return { seq, error: 'Acción desconocida. Recarga la página.' };
  } catch (e) {
    return { seq, item: prev?.item, error: errMsg(e) };
  }
}
