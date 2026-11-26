import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Seriales y token del servicio web de Apple Wallet.
 *
 * Serial = `<tipo>.<negocio>.<id>`: tipo `s` (sellos, id del cliente), `c` (cupón, id del customer_offer `cof_…`) o
 * `g` (gift card, id `gft_…`). Lleva el negocio porque el servicio web solo recibe el serial y el repo busca siempre
 * por negocio (getCustomerCard, findCustomerOffer, getGiftCard). Los ids de la app solo tienen [A-Za-z0-9_-].
 *
 * authenticationToken = HMAC-SHA256(serial) con APPLE_PASS_AUTH_SECRET en base64url (43 caracteres; Apple pide 16+).
 */

export type ApplePassKind = 'stamp' | 'coupon' | 'gift';
export interface AppleSerial { kind: ApplePassKind; businessId: string; id: string }

const PREFIX: Record<ApplePassKind, string> = { stamp: 's', coupon: 'c', gift: 'g' };
const KIND: Record<string, ApplePassKind> = { s: 'stamp', c: 'coupon', g: 'gift' };
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function appleSerial(kind: ApplePassKind, businessId: string, id: string): string {
  if (!ID.test(businessId) || !ID.test(id)) throw new Error('Id inválido para el serial de Apple Wallet');
  return `${PREFIX[kind]}.${businessId}.${id}`;
}

export function parseAppleSerial(serial: string): AppleSerial | null {
  const parts = serial.split('.');
  if (parts.length !== 3) return null;
  const [p, businessId, id] = parts;
  const kind = KIND[p];
  return kind && ID.test(businessId) && ID.test(id) ? { kind, businessId, id } : null;
}

export function appleAuthToken(serial: string, secret: string): string {
  return createHmac('sha256', secret).update(`apple-pass:${serial}`).digest('base64url');
}

/** Encabezado `Authorization: ApplePass <token>` válido para ese serial (comparación de tiempo constante). */
export function checkAppleAuth(header: string | null | undefined, serial: string, secret: string): boolean {
  const m = /^ApplePass\s+(\S+)$/.exec(header?.trim() ?? '');
  if (!m) return false;
  const got = Buffer.from(m[1]);
  const want = Buffer.from(appleAuthToken(serial, secret));
  return got.length === want.length && timingSafeEqual(got, want);
}
