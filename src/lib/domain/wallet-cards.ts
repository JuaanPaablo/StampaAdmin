import type { CustomerOffer, GiftCard, NewOfferInput, Offer, Plan } from '../contracts';
import { cheapestWith, features, PLAN_LABEL } from '../plans';
import { EC_OFFSET_MINUTES, ecEndOfDayIso, ecMonthStartIso, formatCents, isDayKey, parseAmountCents } from './admin-insights';

/**
 * REGLAS PURAS DE CUPONES Y GIFT CARDS (sin base de datos, sin Next, seguras para el navegador).
 * Las usan memory.ts y supabase.ts, las server actions y los formularios. Contrato en docs/TARJETAS.md.
 * Fechas de calendario en Ecuador (UTC-5 fijo), igual que src/lib/domain/admin-insights.ts.
 */

/* ===================================== Límites ===================================== */

export const OFFER_TITLE_MAX = 40;
export const OFFER_DESCRIPTION_MAX = 200;
export const OFFER_TERMS_MAX = 300;
export const OFFER_IMAGE_URL_MAX = 500;
/** Un cupón dura como máximo un año. */
export const OFFER_MAX_DAYS = 366;

/** Saldo máximo de una gift card: US$500. */
export const GIFT_CARD_MAX_CENTS = 50_000;
/**
 * Máximo de dispositivos registrados por pase de Apple (mismo serial). Un pase real vive en 1–3 aparatos; el tope
 * evita que alguien con el token de un pase llene la tabla. Al pasarlo se borra el registro más antiguo.
 */
export const APPLE_MAX_REGISTRATIONS_PER_PASS = 10;

/** Id de operación aceptado (crypto.randomUUID u otro id corto sin símbolos raros). */
const REQUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
/** Limpia el requestId que manda la pantalla. undefined si falta o no es válido (la operación sigue sin idempotencia). */
export function cleanRequestId(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return REQUEST_ID_RE.test(s) ? s : undefined;
}
/** Error cuando un requestId ya se usó en OTRA gift card u otra operación. */
export const REQUEST_ID_REUSED = 'Esta operación ya se registró. Recarga la página y revisa el saldo.';
/** Venta o recarga mínima: US$1. */
export const GIFT_CARD_MIN_CENTS = 100;
export const GIFT_CARD_NOTE_MAX = 200;
export const GIFT_CARD_CODE_LENGTH = 12;
/** Sin 0/O, 1/I/L: se dictan y se escriben sin confusiones. 31 símbolos. */
export const GIFT_CARD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Avisos en Wallet por cliente: máximo 3 cada 24 horas (Google rechaza el cuarto). */
export const WALLET_NOTIFY_MAX = 3;
export const WALLET_NOTIFY_WINDOW_MS = 24 * 3_600_000;

const DAY = 86_400_000;
const EC_OFFSET_MS = EC_OFFSET_MINUTES * 60_000;

export type FieldError<F extends string> = { field: F; error: string } | null;

/* ===================================== Plan ===================================== */

export type WalletFeature = 'offers' | 'giftCards';

/** null si el plan incluye la función; si no, el mensaje para mostrar. */
export function walletFeatureError(plan: Plan | string | undefined | null, feature: WalletFeature): string | null {
  if (features(plan)[feature]) return null;
  const from = cheapestWith((f) => f[feature]);
  const what = feature === 'offers' ? 'Los cupones' : 'Las gift cards';
  if (!from) return `${what} no están disponibles.`;
  return from === 'pro' ? `${what} están disponibles en el plan Pro.` : `${what} están disponibles desde el plan ${PLAN_LABEL[from]}.`;
}

/** Cupones que aún se pueden enviar este mes (nunca negativo). */
export function campaignsRemaining(plan: Plan | string | undefined | null, sentThisMonth: number): number {
  return Math.max(0, features(plan).pushCampaigns - Math.max(0, sentThisMonth));
}

/** Inicio del mes calendario actual en Ecuador (ISO): desde ahí se cuentan las campañas del mes. */
export const campaignMonthStartIso = (nowMs: number = Date.now()): string => ecMonthStartIso(nowMs);

/** Mensaje al llegar al tope de campañas del mes. */
export function campaignLimitError(plan: Plan | string | undefined | null): string {
  const n = features(plan).pushCampaigns;
  return `Tu plan ${features(plan).label} permite enviar ${n === 1 ? '1 cupón' : `${n} cupones`} por mes. Ya llegaste al límite de este mes.`;
}

/** Crear/enviar cupones y vender/recargar/anular gift cards es solo para dueño o gerente. */
export const WALLET_MANAGER_ONLY = 'Solo el dueño o un gerente pueden hacer esto.';

/* ===================================== Cercanía (coordenadas de sucursales) ===================================== */

/** Valida coordenadas (números finitos dentro de rango; 0,0 se rechaza porque casi siempre es un error). */
export function validateCoords(latitude: unknown, longitude: unknown): string | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'Escribe la latitud y la longitud.';
  }
  if (latitude < -90 || latitude > 90) return 'La latitud debe estar entre -90 y 90.';
  if (longitude < -180 || longitude > 180) return 'La longitud debe estar entre -180 y 180.';
  if (latitude === 0 && longitude === 0) return 'Esas coordenadas no son válidas.';
  return null;
}

/**
 * Lee coordenadas de lo que pega el dueño: "-2.1709, -79.9224", un enlace de Google Maps con "@lat,lng", "q=lat,lng",
 * "ll=lat,lng" o "!3dlat!4dlng". Redondea a 6 decimales (~10 cm). null si no encuentra un par válido.
 * Los enlaces cortos (maps.app.goo.gl) no traen coordenadas: hay que abrirlos y copiar el enlace largo.
 */
export function parseCoordsInput(input: string): { latitude: number; longitude: number } | null {
  let s = String(input ?? '').replace(/\+/g, ' ');
  try { s = decodeURIComponent(s); } catch { /* enlace mal escapado: se usa tal cual */ }
  s = s.trim();
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`),
    new RegExp(String.raw`@${num},${num}`),
    new RegExp(String.raw`[?&](?:q|query|ll|center|destination)=${num},\s*${num}`),
    new RegExp(String.raw`^${num}\s*[,; ]\s*${num}$`)
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const latitude = Math.round(Number(m[1]) * 1e6) / 1e6;
    const longitude = Math.round(Number(m[2]) * 1e6) / 1e6;
    if (!validateCoords(latitude, longitude)) return { latitude, longitude };
  }
  return null;
}

/** Enlace para ver un punto en Google Maps (vista previa en Ajustes). */
export const googleMapsUrl = (latitude: number, longitude: number): string => `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

/* ===================================== Avisos ===================================== */

/** Desde cuándo se cuentan los avisos para el tope (ISO). */
export const notifyWindowStartIso = (nowMs: number = Date.now()): string => new Date(nowMs - WALLET_NOTIFY_WINDOW_MS).toISOString();

/** true si aún se puede avisar a un cliente que recibió `sentLast24h` avisos en las últimas 24 h. */
export const canNotify = (sentLast24h: number): boolean => sentLast24h < WALLET_NOTIFY_MAX;

/* ===================================== Cupones ===================================== */

const cleanText = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const validIso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** Inicio del día 'YYYY-MM-DD' en Ecuador (00:00:00), en ISO. */
export function ecStartOfDayIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - EC_OFFSET_MS).toISOString();
}

/** Vigencia a partir de dos días del formulario ('YYYY-MM-DD', Ecuador): desde las 00:00 del primero hasta las 23:59:59 del último. */
export function offerWindowFromDays(startDay: string, endDay: string): { startsAt: string; endsAt: string } | null {
  if (!isDayKey(startDay) || !isDayKey(endDay)) return null;
  return { startsAt: ecStartOfDayIso(startDay), endsAt: ecEndOfDayIso(endDay) };
}

/** Copia limpia del formulario (espacios recortados, opcionales vacíos = undefined). */
export function cleanOfferInput(input: Partial<NewOfferInput>): NewOfferInput {
  return {
    title: cleanText(input.title),
    description: cleanText(input.description),
    terms: (typeof input.terms === 'string' ? input.terms.trim() : '') || undefined,
    imageUrl: (typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '') || undefined,
    startsAt: validIso(input.startsAt) ? new Date(input.startsAt).toISOString() : String(input.startsAt ?? ''),
    endsAt: validIso(input.endsAt) ? new Date(input.endsAt).toISOString() : String(input.endsAt ?? '')
  };
}

export type OfferField = 'title' | 'description' | 'terms' | 'imageUrl' | 'startsAt' | 'endsAt';

/**
 * Valida un cupón (pasa antes por cleanOfferInput). Devuelve el primer problema o null.
 * `nowMs`: el cupón no puede terminar en el pasado.
 */
export function validateOffer(input: NewOfferInput, nowMs: number = Date.now()): FieldError<OfferField> {
  if (input.title.length < 2) return { field: 'title', error: 'Escribe el título del cupón.' };
  if (input.title.length > OFFER_TITLE_MAX) return { field: 'title', error: `El título es muy largo (máximo ${OFFER_TITLE_MAX} letras).` };
  if (input.description.length < 2) return { field: 'description', error: 'Escribe qué incluye el cupón.' };
  if (input.description.length > OFFER_DESCRIPTION_MAX) return { field: 'description', error: `La descripción es muy larga (máximo ${OFFER_DESCRIPTION_MAX} letras).` };
  if (input.terms && input.terms.length > OFFER_TERMS_MAX) return { field: 'terms', error: `Las condiciones son muy largas (máximo ${OFFER_TERMS_MAX} letras).` };
  if (input.imageUrl && (input.imageUrl.length > OFFER_IMAGE_URL_MAX || !/^https:\/\/[^\s]+$/i.test(input.imageUrl))) {
    return { field: 'imageUrl', error: 'La imagen debe ser un enlace https.' };
  }
  if (!validIso(input.startsAt)) return { field: 'startsAt', error: 'Elige desde cuándo vale el cupón.' };
  if (!validIso(input.endsAt)) return { field: 'endsAt', error: 'Elige hasta cuándo vale el cupón.' };
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (end <= start) return { field: 'endsAt', error: 'La fecha final debe ser posterior a la inicial.' };
  if (end <= nowMs) return { field: 'endsAt', error: 'La fecha final ya pasó.' };
  if (end - start > OFFER_MAX_DAYS * DAY) return { field: 'endsAt', error: 'Un cupón puede durar como máximo un año.' };
  return null;
}

/** true si la oferta está dentro de sus fechas (sin mirar el estado). */
export function offerInWindow(offer: Pick<Offer, 'startsAt' | 'endsAt'>, nowMs: number = Date.now()): boolean {
  return Date.parse(offer.startsAt) <= nowMs && nowMs <= Date.parse(offer.endsAt);
}

/** Enviada y dentro de sus fechas. */
export function isOfferLive(offer: Pick<Offer, 'status' | 'startsAt' | 'endsAt'>, nowMs: number = Date.now()): boolean {
  return offer.status === 'sent' && offerInWindow(offer, nowMs);
}

/** Por qué no se puede canjear un cupón de cliente (null = se puede). */
export function customerOfferRedeemError(
  co: Pick<CustomerOffer, 'redeemedAt'>,
  offer: Pick<Offer, 'status' | 'startsAt' | 'endsAt'>,
  nowMs: number = Date.now()
): string | null {
  if (co.redeemedAt) return 'Este cupón ya se usó.';
  if (offer.status === 'ended') return 'Este cupón ya terminó.';
  if (offer.status !== 'sent') return 'Este cupón todavía no se envió.';
  if (nowMs < Date.parse(offer.startsAt)) return 'Este cupón todavía no está vigente.';
  if (nowMs > Date.parse(offer.endsAt)) return 'Este cupón ya venció.';
  return null;
}

/** Cupones que se muestran en la tarjeta del cliente: vigentes y sin usar, el que vence antes primero. */
export function liveCustomerOffers<T extends Pick<CustomerOffer, 'redeemedAt'> & { offer: Pick<Offer, 'status' | 'startsAt' | 'endsAt'> }>(
  list: T[], nowMs: number = Date.now()
): T[] {
  return list
    .filter((co) => !co.redeemedAt && isOfferLive(co.offer, nowMs))
    .sort((a, b) => Date.parse(a.offer.endsAt) - Date.parse(b.offer.endsAt));
}

/** Estado legible: "Borrador", "Programado", "Vigente", "Vencido", "Terminado". */
export function offerStatusLabel(offer: Pick<Offer, 'status' | 'startsAt' | 'endsAt'>, nowMs: number = Date.now()): string {
  if (offer.status === 'draft') return 'Borrador';
  if (offer.status === 'ended') return 'Terminado';
  if (nowMs < Date.parse(offer.startsAt)) return 'Programado';
  if (nowMs > Date.parse(offer.endsAt)) return 'Vencido';
  return 'Vigente';
}

/* ===================================== Gift cards: código ===================================== */

const CODE_RE = new RegExp(`^[${GIFT_CARD_ALPHABET}]{${GIFT_CARD_CODE_LENGTH}}$`);

/** Código nuevo de 12 caracteres. `rand` ([0,1)) solo para pruebas y datos de ejemplo; por defecto crypto.getRandomValues sin sesgo. */
export function generateGiftCardCode(rand?: () => number): string {
  const n = GIFT_CARD_ALPHABET.length;
  let out = '';
  if (rand) {
    for (let i = 0; i < GIFT_CARD_CODE_LENGTH; i++) out += GIFT_CARD_ALPHABET[Math.floor(rand() * n) % n];
    return out;
  }
  const limit = 256 - (256 % n);   // descarta bytes que sesgarían la distribución
  const buf = new Uint8Array(32);
  while (out.length < GIFT_CARD_CODE_LENGTH) {
    globalThis.crypto.getRandomValues(buf);
    for (const b of buf) if (b < limit && out.length < GIFT_CARD_CODE_LENGTH) out += GIFT_CARD_ALPHABET[b % n];
  }
  return out;
}

/**
 * Normaliza lo que escribe o escanea Caja: acepta minúsculas, espacios y guiones ("abcd-efgh jkmn").
 * Devuelve el código de 12 caracteres o null si no tiene esa forma.
 */
export function normalizeGiftCardCode(input: string | null | undefined): string | null {
  const s = String(input ?? '').toUpperCase().replace(/[\s\-–—_.]+/g, '');
  return CODE_RE.test(s) ? s : null;
}

export const isGiftCardCode = (v: unknown): v is string => typeof v === 'string' && CODE_RE.test(v);

/** "ABCD-EFGH-JKMN" para mostrar e imprimir. */
export function formatGiftCardCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? [code]).join('-');
}

/** "•••• •••• JKMN": para listas donde no hace falta el código completo. */
export const maskGiftCardCode = (code: string): string => `•••• •••• ${code.slice(-4)}`;

/* ===================================== Gift cards: montos ===================================== */

export type AmountResult = { ok: true; cents: number } | { ok: false; error: string };

/** Lee un monto escrito a mano ("10", "10,50", "$1.234,56"). Reusa parseAmountCents del panel de administrador. */
export function parseGiftCardAmount(input: string): AmountResult {
  const cents = parseAmountCents(input);
  if (!cents) return { ok: false, error: 'Escribe un monto válido, por ejemplo 10 o 12,50.' };
  return { ok: true, cents };
}

/** Valida una venta (issue) o recarga (topup) sobre el saldo actual. */
export function validateGiftCardLoad(amountCents: number, currentBalanceCents = 0): string | null {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Escribe el monto.';
  if (amountCents < GIFT_CARD_MIN_CENTS) return `El monto mínimo es ${formatCents(GIFT_CARD_MIN_CENTS)}.`;
  if (currentBalanceCents + amountCents > GIFT_CARD_MAX_CENTS) {
    const room = Math.max(0, GIFT_CARD_MAX_CENTS - currentBalanceCents);
    return currentBalanceCents
      ? `El saldo máximo es ${formatCents(GIFT_CARD_MAX_CENTS)}. Puedes recargar hasta ${formatCents(room)}.`
      : `El saldo máximo es ${formatCents(GIFT_CARD_MAX_CENTS)}.`;
  }
  return null;
}

/** Valida un cobro sobre una gift card. */
export function validateGiftCardCharge(amountCents: number, card: Pick<GiftCard, 'balanceCents' | 'status'>): string | null {
  if (card.status !== 'active') return 'Esta gift card está anulada.';
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Escribe el monto a cobrar.';
  if (amountCents > card.balanceCents) return `Saldo insuficiente: quedan ${formatCents(card.balanceCents)}.`;
  return null;
}

/** Nota opcional de un movimiento (recortada, máx. 200). */
export function cleanGiftCardNote(note: string | undefined | null): string | undefined {
  const s = (note ?? '').trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, GIFT_CARD_NOTE_MAX) : undefined;
}

export { formatCents };
