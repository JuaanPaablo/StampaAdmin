import type { CustomerOfferWithOffer, Offer } from '../contracts';
import {
  classSuffix, googleSaveJwtUrl, googleWalletConfig, safeId, upsertResource,
  type GoogleBrand, type GoogleWalletConfig
} from './google';

/**
 * Cupones en Google Wallet: una `offerClass` por negocio y cupón (título, descripción, condiciones, imagen, vigencia
 * son de la clase) y un `offerObject` por cupón de cliente (`customer_offers`). El QR del objeto es
 * `STAMPA-CUPON:<customerOfferId>` (fijo, ver docs/TARJETAS.md). Canjeado → COMPLETED; terminado o vencido → EXPIRED.
 * Google además pasa a "vencidos" el objeto cuando termina validTimeInterval y avisa antes de vencer.
 */

export type GoogleObjectState = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'INACTIVE';

export const couponQrValue = (customerOfferId: string) => `STAMPA-CUPON:${customerOfferId}`;

export const offerClassId = (issuerId: string, businessId: string, offerId: string) =>
  `${issuerId}.${classSuffix(businessId)}_${safeId(offerId)}`;
export const offerObjectId = (issuerId: string, customerOfferId: string) => `${issuerId}.${safeId(customerOfferId)}`;

const httpsImage = (url: string | undefined, alt: string) =>
  url && /^https:\/\//.test(url) ? { sourceUri: { uri: url }, contentDescription: { defaultValue: { language: 'es', value: alt } } } : null;

export function offerClassFor(brand: GoogleBrand, offer: Offer, issuerId: string) {
  const hero = httpsImage(offer.imageUrl, offer.title);
  return {
    id: offerClassId(issuerId, brand.businessId, offer.id),
    issuerName: brand.issuerName,
    provider: brand.businessName,
    title: offer.title,
    ...(offer.description ? { details: offer.description } : {}),
    ...(offer.terms ? { finePrint: offer.terms } : {}),
    redemptionChannel: 'INSTORE',
    reviewStatus: 'UNDER_REVIEW',
    titleImage: brand.logo,
    ...(hero ? { heroImage: hero } : {}),
    hexBackgroundColor: brand.bg,
    countryCode: 'EC',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    ...(brand.merchantLocations.length ? { merchantLocations: brand.merchantLocations.slice(0, 10) } : {})
  };
}

/** Estado del objeto en Google: canjeado → COMPLETED; terminado a mano o pasada la fecha → EXPIRED; si no ACTIVE. */
export function offerObjectState(
  co: { redeemedAt?: string; offer: Pick<Offer, 'status' | 'endsAt'> },
  nowMs: number = Date.now()
): GoogleObjectState {
  if (co.redeemedAt) return 'COMPLETED';
  if (co.offer.status === 'ended' || Date.parse(co.offer.endsAt) < nowMs) return 'EXPIRED';
  return 'ACTIVE';
}

export function googleOfferObject(brand: GoogleBrand, co: CustomerOfferWithOffer, issuerId: string, nowMs: number = Date.now()) {
  return {
    id: offerObjectId(issuerId, co.id),
    classId: offerClassId(issuerId, brand.businessId, co.offer.id),
    state: offerObjectState(co, nowMs),
    barcode: { type: 'QR_CODE', value: couponQrValue(co.id), alternateText: co.id },
    validTimeInterval: { start: { date: co.offer.startsAt }, end: { date: co.offer.endsAt } },
    linksModuleData: { uris: [{ id: 'tarjeta', uri: brand.cardUrl, description: 'Abrir mi tarjeta' }] },
    ...(brand.merchantLocations.length ? { merchantLocations: brand.merchantLocations.slice(0, 10) } : {})
  };
}

/** Enlace "Guardar en Google Wallet" de un cupón (clase + objeto en el JWT). */
export function googleOfferSaveUrl(brand: GoogleBrand, co: CustomerOfferWithOffer, config: GoogleWalletConfig, now: Date = new Date()): string {
  return googleSaveJwtUrl(config, {
    offerClasses: [offerClassFor(brand, co.offer, config.issuerId)],
    offerObjects: [googleOfferObject(brand, co, config.issuerId, now.getTime())]
  }, now);
}

/**
 * Actualiza (solo PATCH) el objeto de un cupón: tras canjearlo, terminarlo, o antes de guardarlo.
 * 'missing' = el cliente no lo tiene en Google. Nunca lanza.
 */
export async function syncGoogleOfferObject(brand: GoogleBrand, co: CustomerOfferWithOffer): Promise<'ok' | 'missing' | 'error' | 'disabled'> {
  const config = googleWalletConfig();
  if (!config) return 'disabled';
  return upsertResource(config, 'offerObject', googleOfferObject(brand, co, config.issuerId));
}
