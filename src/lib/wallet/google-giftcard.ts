import type { GiftCard } from '../contracts';
import { formatGiftCardCode } from '../domain/wallet-cards';
import {
  classSuffix, googleSaveJwtUrl, googleWalletConfig, safeId, upsertResource,
  type GoogleBrand, type GoogleWalletConfig
} from './google';

/**
 * Gift cards en Google Wallet: una `giftCardClass` por negocio y un `giftCardObject` por gift card. El saldo va como
 * Money ({ micros, currencyCode: 'USD' }); el QR es `STAMPA-GIFT:<code>` (fijo, ver docs/TARJETAS.md) y debajo el
 * código legible `XXXX XXXX XXXX`. Anulada → INACTIVE. Tras cada movimiento se hace PATCH (syncGoogleGiftCardObject).
 */

export const giftQrValue = (code: string) => `STAMPA-GIFT:${code}`;

export const giftCardClassId = (issuerId: string, businessId: string) => `${issuerId}.${classSuffix(businessId)}_gift`;
export const giftCardObjectId = (issuerId: string, giftCardId: string) => `${issuerId}.${safeId(giftCardId)}`;

/** Centavos → Money de Google (micros en texto: int64 en JSON). 1 centavo = 10 000 micros. */
export function centsToMoney(cents: number) {
  const c = Math.max(0, Math.round(cents));
  return { micros: String(c * 10_000), currencyCode: 'USD' };
}

export function giftCardClassFor(brand: GoogleBrand, issuerId: string) {
  return {
    id: giftCardClassId(issuerId, brand.businessId),
    issuerName: brand.issuerName,
    merchantName: brand.businessName,
    programLogo: brand.logo,
    cardNumberLabel: 'Código',
    hexBackgroundColor: brand.bg,
    countryCode: 'EC',
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    ...(brand.merchantLocations.length ? { merchantLocations: brand.merchantLocations.slice(0, 10) } : {})
  };
}

export interface GiftObjectOptions {
  /** Hora del último cambio de saldo (ISO). Por defecto, ahora. */
  balanceUpdatedAt?: string;
  /**
   * Pide a Google avisar del cambio (`notifyPreference: 'NOTIFY'`). Google solo avisa si el campo cambiado está en su
   * lista permitida y respeta su propio tope: no se puede confiar en que llegue. Úsese solo en recargas.
   */
  notify?: boolean;
}

export function googleGiftCardObject(brand: GoogleBrand, g: GiftCard, issuerId: string, opts: GiftObjectOptions = {}) {
  return {
    id: giftCardObjectId(issuerId, g.id),
    classId: giftCardClassId(issuerId, brand.businessId),
    state: g.status === 'void' ? 'INACTIVE' : 'ACTIVE',
    cardNumber: formatGiftCardCode(g.code),
    balance: centsToMoney(g.status === 'void' ? 0 : g.balanceCents),
    balanceUpdateTime: { date: opts.balanceUpdatedAt ?? new Date().toISOString() },
    barcode: { type: 'QR_CODE', value: giftQrValue(g.code), alternateText: formatGiftCardCode(g.code).replace(/-/g, ' ') },
    linksModuleData: { uris: [{ id: 'tarjeta', uri: brand.cardUrl, description: 'Abrir mi tarjeta' }] },
    ...(brand.merchantLocations.length ? { merchantLocations: brand.merchantLocations.slice(0, 10) } : {}),
    ...(opts.notify ? { notifyPreference: 'NOTIFY' } : {})
  };
}

/** Enlace "Guardar en Google Wallet" de una gift card (clase + objeto en el JWT). */
export function googleGiftCardSaveUrl(brand: GoogleBrand, g: GiftCard, config: GoogleWalletConfig, now: Date = new Date()): string {
  return googleSaveJwtUrl(config, {
    giftCardClasses: [giftCardClassFor(brand, config.issuerId)],
    giftCardObjects: [googleGiftCardObject(brand, g, config.issuerId, { balanceUpdatedAt: now.toISOString() })]
  }, now);
}

/** PATCH del objeto de la gift card tras un movimiento (404 = no la guardó: 'missing'). Nunca lanza. */
export async function syncGoogleGiftCardObject(brand: GoogleBrand, g: GiftCard, opts: GiftObjectOptions = {}): Promise<'ok' | 'missing' | 'error' | 'disabled'> {
  const config = googleWalletConfig();
  if (!config) return 'disabled';
  return upsertResource(config, 'giftCardObject', googleGiftCardObject(brand, g, config.issuerId, opts));
}
