import type { CustomerCard, CustomerOfferWithOffer, GiftCard } from '../../contracts';
import { formatCents, formatGiftCardCode, isOfferLive } from '../../domain/wallet-cards';
import { appUrl, customerUrl } from '../../urls';
import { buildPassModel, headline, type PassModel } from '../pass-model';
import { appleAuthToken, appleSerial } from './auth';
import type { AppleWalletConfig } from './config';

/**
 * pass.json de Apple Wallet para los tres estilos (docs/TARJETAS.md):
 *   - Sellos: storeCard. Serial `s.<negocio>.<cliente>`.
 *   - Cupón: coupon. Serial `c.<negocio>.<cof_…>`. QR `STAMPA-CUPON:<cof_…>`. Se anula (voided) al usarse o terminarse.
 *   - Gift card: storeCard con el saldo. Serial `g.<negocio>.<gft_…>`. QR `STAMPA-GIFT:<código>`.
 * Puro: no firma (eso es pkpass.ts) ni lee la base de datos.
 *
 * Avisos en la pantalla bloqueada: iOS muestra el `changeMessage` de un campo cuyo valor cambió al bajar el pase
 * nuevo (tras el push APNs). Por eso cambian: titular de los sellos ("%@"), el saldo ("Tu saldo ahora es %@") y, en la
 * tarjeta de sellos, el campo del cupón más nuevo ("Nuevo cupón: %@").
 */

type Ids = Pick<AppleWalletConfig, 'passTypeId' | 'teamId' | 'authSecret'>;
type Field = Record<string, unknown> & { key: string; label?: string; value: string | number };

/** Un cupón cuenta como "recién llegado" (su campo lleva changeMessage) durante este tiempo desde que se entregó. */
export const FRESH_COUPON_MS = 24 * 60 * 60 * 1000;
const MAX_DISTANCE_M = 100;
const TZ = 'America/Guayaquil';

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** "30 de noviembre de 2026" (hora de Ecuador). */
export function ecDateText(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Código legible bajo el QR: "XXXX XXXX XXXX". */
const spacedCode = (code: string) => formatGiftCardCode(code).replace(/-/g, ' ');

export function modelFor(card: CustomerCard, now: Date): PassModel {
  return buildPassModel(card.business, card.program, card.customer, customerUrl(card.business.slug), card.locations ?? [], now);
}

/** webServiceURL solo con https (iOS rechaza http fuera del modo de desarrollador). */
function webService(serial: string, ids: Ids) {
  const base = appUrl();
  return /^https:\/\//.test(base) ? { webServiceURL: `${base}/api/wallet`, authenticationToken: appleAuthToken(serial, ids.authSecret) } : {};
}

function common(m: PassModel, serial: string, ids: Ids, description: string, relevantText: string) {
  return {
    formatVersion: 1,
    passTypeIdentifier: ids.passTypeId,
    teamIdentifier: ids.teamId,
    serialNumber: serial,
    organizationName: m.businessName,
    description,
    logoText: m.businessName,
    backgroundColor: rgb(m.colors.bg),
    foregroundColor: rgb(m.colors.fg),
    labelColor: rgb(m.colors.label),
    sharingProhibited: true,
    ...webService(serial, ids),
    ...(m.locations.length
      ? { locations: m.locations.slice(0, 10).map((l) => ({ latitude: l.latitude, longitude: l.longitude, relevantText })), maxDistance: MAX_DISTANCE_M }
      : {})
  };
}

const cardLink = (m: PassModel): Field => ({ key: 'card', label: 'Tu tarjeta', value: m.cardUrl, attributedValue: `<a href="${m.cardUrl}">Abrir mi tarjeta</a>` });

/** Cupón más nuevo vigente y sin usar (por fecha de entrega). */
function newestCoupon(card: CustomerCard, nowMs: number): CustomerOfferWithOffer | null {
  const live = (card.offers ?? []).filter((co) => !co.redeemedAt && isOfferLive(co.offer, nowMs));
  return live.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

export interface StampPassOptions {
  /**
   * Último aviso libre para el cliente (notifyApple). Requiere guardarlo en la base (ver docs/WALLET.md → Apple):
   * mientras el repo no lo guarde, no se usa. Va en un campo del reverso con changeMessage "%@".
   */
  notice?: { text: string; at: string };
}

/** Tarjeta de sellos (storeCard). */
export function stampPassJson(card: CustomerCard, ids: Ids, now: Date = new Date(), opts: StampPassOptions = {}) {
  const m = modelFor(card, now);
  const serial = appleSerial('stamp', card.business.id, card.customer.id);
  const nowMs = now.getTime();
  const newest = newestCoupon(card, nowMs);
  const fresh = !!newest && nowMs - Date.parse(newest.createdAt) < FRESH_COUPON_MS;
  const live = (card.offers ?? []).filter((co) => !co.redeemedAt && isOfferLive(co.offer, nowMs));

  const secondary: Field[] = [];
  if (m.readyReward) secondary.push({ key: 'reward', label: 'PREMIO LISTO', value: m.readyReward });
  else if (m.nextReward) secondary.push({ key: 'reward', label: 'PRÓXIMO PREMIO', value: m.nextReward.title });
  secondary.push({ key: 'customer', label: 'CLIENTE', value: m.customerName });

  const back: Field[] = [];
  if (opts.notice) back.push({ key: 'notice', label: 'Aviso', value: opts.notice.text, changeMessage: '%@' });
  if (live.length) {
    back.push({
      key: 'coupons', label: 'Tus cupones',
      value: live.map((co) => `• ${co.offer.title} (hasta el ${ecDateText(co.offer.endsAt)})`).join('\n') + '\nAgrégalos a tu Wallet desde tu tarjeta.'
    });
  }
  back.push(cardLink(m));
  if (m.terms) back.push({ key: 'terms', label: 'Condiciones', value: m.terms });
  back.push({ key: 'stampa', label: 'Stampa', value: 'Tarjeta de sellos digital de Stampa.' });

  return {
    ...common(m, serial, ids, `${m.programName} de ${m.businessName}`, 'Estás cerca. ¡Suma tu sello!'),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: m.cardUrl, messageEncoding: 'iso-8859-1', altText: m.customerName }],
    storeCard: {
      headerFields: [{ key: 'stamps', label: 'SELLOS', value: m.progressText }],
      primaryFields: [{ key: 'headline', label: m.programName.toUpperCase(), value: headline(m), changeMessage: '%@' }],
      secondaryFields: secondary,
      auxiliaryFields: [{
        key: 'coupon', label: 'CUPÓN', value: newest ? newest.offer.title : 'Sin cupones por ahora',
        // Solo un cupón recién entregado avisa: si el valor cambia porque se usó otro, no debe decir "Nuevo cupón".
        ...(fresh ? { changeMessage: 'Nuevo cupón: %@' } : {})
      }],
      backFields: back
    }
  };
}

/** Estado legible de un cupón para el pase. */
export function couponState(co: CustomerOfferWithOffer, nowMs: number): { label: string; voided: boolean } {
  if (co.redeemedAt) return { label: 'Usado', voided: true };
  if (co.offer.status === 'ended') return { label: 'Terminado', voided: true };
  if (nowMs < Date.parse(co.offer.startsAt)) return { label: `Desde el ${ecDateText(co.offer.startsAt)}`, voided: false };
  if (nowMs > Date.parse(co.offer.endsAt)) return { label: 'Vencido', voided: false };   // expirationDate ya lo marca
  return { label: 'Listo para usar', voided: false };
}

/** Cupón (coupon). */
export function couponPassJson(card: CustomerCard, co: CustomerOfferWithOffer, ids: Ids, now: Date = new Date()) {
  const m = modelFor(card, now);
  const serial = appleSerial('coupon', card.business.id, co.id);
  const state = couponState(co, now.getTime());
  const back: Field[] = [
    { key: 'description', label: 'Detalle', value: co.offer.description },
    ...(co.offer.terms ? [{ key: 'terms', label: 'Condiciones', value: co.offer.terms }] : []),
    { key: 'use', label: 'Cómo usarlo', value: 'Muestra este código en caja. Se puede usar una sola vez.' },
    cardLink(m)
  ];
  return {
    ...common(m, serial, ids, `Cupón de ${m.businessName}: ${co.offer.title}`, 'Tienes un cupón para usar aquí'),
    expirationDate: new Date(co.offer.endsAt).toISOString(),
    ...(state.voided ? { voided: true } : {}),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: `STAMPA-CUPON:${co.id}`, messageEncoding: 'iso-8859-1' }],
    coupon: {
      primaryFields: [{ key: 'title', label: 'CUPÓN', value: co.offer.title }],
      secondaryFields: [{ key: 'valid', label: 'VÁLIDO HASTA', value: ecDateText(co.offer.endsAt) }],
      auxiliaryFields: [{ key: 'state', label: 'ESTADO', value: state.label }],
      backFields: back
    }
  };
}

/** Gift card (storeCard con el saldo). */
export function giftPassJson(card: CustomerCard, gift: GiftCard, ids: Ids, now: Date = new Date()) {
  const m = modelFor(card, now);
  const serial = appleSerial('gift', card.business.id, gift.id);
  const voided = gift.status === 'void';
  const code = spacedCode(gift.code);
  return {
    ...common(m, serial, ids, `Gift card de ${m.businessName}`, 'Usa tu gift card aquí'),
    ...(voided ? { voided: true } : {}),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: `STAMPA-GIFT:${gift.code}`, messageEncoding: 'iso-8859-1', altText: code }],
    storeCard: {
      headerFields: [{ key: 'kind', label: 'GIFT CARD', value: voided ? 'Anulada' : 'Activa' }],
      primaryFields: [{ key: 'balance', label: 'SALDO', value: formatCents(gift.balanceCents), changeMessage: 'Tu saldo ahora es %@' }],
      secondaryFields: [{ key: 'code', label: 'CÓDIGO', value: code }],
      backFields: [
        { key: 'use', label: 'Cómo usarla', value: 'Muestra este código en caja para pagar con tu saldo. Tu saldo se actualiza solo.' },
        { key: 'initial', label: 'Valor inicial', value: formatCents(gift.initialCents) },
        cardLink(m)
      ] as Field[]
    }
  };
}
