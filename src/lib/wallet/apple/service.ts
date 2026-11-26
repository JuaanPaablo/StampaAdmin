import { createHash } from 'node:crypto';
import type { CustomerCard, CustomerOfferWithOffer, GiftCard } from '../../contracts';
import { getRepo } from '../../repo';
import { appleSerial, parseAppleSerial } from './auth';
import type { AppleWalletConfig } from './config';
import { APPLE_IMAGES } from './images';
import { couponPassJson, giftPassJson, stampPassJson } from './passes';
import { buildManifest, buildPkpass } from './pkpass';

/**
 * Arma el .pkpass firmado de un pase (descarga del cliente y servicio web). Las imágenes van incrustadas en
 * images.ts (generadas por scripts/apple-wallet-images.ps1), así que no se lee nada del disco en Vercel.
 */

export type ApplePassSource =
  | { kind: 'stamp'; card: CustomerCard }
  | { kind: 'coupon'; card: CustomerCard; coupon: CustomerOfferWithOffer }
  | { kind: 'gift'; card: CustomerCard; gift: GiftCard };

export interface BuiltApplePass {
  serial: string;
  /** Bytes del .pkpass (zip firmado). */
  body: Buffer;
  /**
   * Fecha para Last-Modified derivada del CONTENIDO (manifest): misma fecha = mismo pase. El servicio web responde 304
   * solo si If-Modified-Since es exactamente esta fecha (iOS devuelve tal cual la que recibió). Así no hace falta
   * guardar versiones en la base y nunca se responde 304 con un pase que cambió.
   */
  lastModified: Date;
  fileName: string;
}

const imageFiles = (() => {
  const out: Record<string, Buffer> = {};
  for (const [name, b64] of Object.entries(APPLE_IMAGES)) out[name] = Buffer.from(b64, 'base64');
  return out;
})();

const BASE_MS = Date.UTC(2020, 0, 1);
const SPAN_S = 5 * 365 * 24 * 3600;
/** Fecha estable (en segundos enteros) a partir del hash del manifest. */
export function contentDate(manifest: Buffer): Date {
  const h = createHash('sha256').update(manifest).digest();
  return new Date(BASE_MS + (h.readUInt32BE(0) % SPAN_S) * 1000);
}

export function passJsonFor(src: ApplePassSource, cfg: AppleWalletConfig, now: Date): object {
  if (src.kind === 'stamp') return stampPassJson(src.card, cfg, now);
  if (src.kind === 'coupon') return couponPassJson(src.card, src.coupon, cfg, now);
  return giftPassJson(src.card, src.gift, cfg, now);
}

export function serialFor(src: ApplePassSource): string {
  if (src.kind === 'stamp') return appleSerial('stamp', src.card.business.id, src.card.customer.id);
  if (src.kind === 'coupon') return appleSerial('coupon', src.card.business.id, src.coupon.id);
  return appleSerial('gift', src.card.business.id, src.gift.id);
}

export function buildApplePass(src: ApplePassSource, cfg: AppleWalletConfig, now: Date = new Date()): BuiltApplePass {
  const files: Record<string, Buffer> = { ...imageFiles, 'pass.json': Buffer.from(JSON.stringify(passJsonFor(src, cfg, now)), 'utf8') };
  const body = buildPkpass(files, cfg, now);
  const slug = src.card.business.slug.replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'stampa';
  const fileName = src.kind === 'stamp' ? `${slug}-sellos.pkpass` : src.kind === 'coupon' ? `${slug}-cupon.pkpass` : `${slug}-gift-card.pkpass`;
  return { serial: serialFor(src), body, lastModified: contentDate(buildManifest(files)), fileName };
}

/**
 * Busca lo que identifica un serial (sin sesión: el servicio web ya validó el token). null si ya no existe.
 * Los cupones usados y las gift cards anuladas SÍ se devuelven (el pase nuevo sale anulado).
 */
export async function resolveAppleSerial(serial: string): Promise<ApplePassSource | null> {
  const s = parseAppleSerial(serial);
  if (!s) return null;
  const repo = getRepo();
  if (s.kind === 'stamp') {
    const card = await repo.getCustomerCard(s.businessId, s.id);
    return card ? { kind: 'stamp', card } : null;
  }
  if (s.kind === 'coupon') {
    const detail = await repo.findCustomerOffer(s.businessId, s.id);
    if (!detail) return null;
    const card = await repo.getCustomerCard(s.businessId, detail.customerId);
    if (!card) return null;
    const { customerName: _n, ...coupon } = detail;
    void _n;
    return { kind: 'coupon', card, coupon };
  }
  const gift = await repo.getGiftCard(s.businessId, s.id);
  if (!gift?.customerId) return null;
  const card = await repo.getCustomerCard(s.businessId, gift.customerId);
  return card ? { kind: 'gift', card, gift } : null;
}

/** Respuesta HTTP con el .pkpass. */
export function pkpassResponse(pass: BuiltApplePass, extra: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(pass.body), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.apple.pkpass',
      'content-disposition': `attachment; filename="${pass.fileName}"`,
      'cache-control': 'no-store',
      'last-modified': pass.lastModified.toUTCString(),
      ...extra
    }
  });
}
