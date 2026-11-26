/**
 * Reglas puras de la sección de Wallet de la página del cliente (y fechas que comparte Caja).
 * Sin Next ni base de datos: seguras en el servidor y en el navegador.
 */

export type DevicePlatform = 'ios' | 'android' | 'unknown';
export type WalletKind = 'apple' | 'google';

/**
 * Plataforma por el user-agent. Android primero (algunos navegadores de Android dicen "like iPhone" en modos raros).
 * El iPad en "modo escritorio" se presenta como Mac: queda 'unknown' y se muestran ambos botones.
 */
export function detectPlatform(userAgent: string | null | undefined): DevicePlatform {
  const ua = userAgent ?? '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'unknown';
}

/**
 * Qué botones de Wallet mostrar y en qué orden. Con plataforma clara solo el suyo (Google Wallet no existe en iPhone
 * y Apple Wallet no existe en Android); sin saberla, ambos (Apple primero).
 */
export function walletButtons(platform: DevicePlatform, available: { apple: boolean; google: boolean }): WalletKind[] {
  const order: WalletKind[] = platform === 'android' ? ['google'] : platform === 'ios' ? ['apple'] : ['apple', 'google'];
  return order.filter((k) => available[k]);
}

/** Rutas fijas de docs/TARJETAS.md. */
export function walletHref(slug: string, kind: WalletKind, item?: { type: 'cupon' | 'gift'; id: string }): string {
  const base = `/u/${encodeURIComponent(slug)}/wallet/${kind}`;
  return item ? `${base}/${item.type}/${encodeURIComponent(item.id)}` : base;
}

/** Contenido fijo de los QR (docs/TARJETAS.md → "Contenido de los códigos QR"). */
export const couponQrText = (customerOfferId: string): string => `STAMPA-CUPON:${customerOfferId}`;
export const giftQrText = (code: string): string => `STAMPA-GIFT:${code}`;

/** "ABCD EFGH JKMN": código legible debajo del QR. */
export function spacedGiftCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? [code]).join(' ');
}

const EC_TZ = 'America/Guayaquil';

/** "30 nov 2026" en hora de Ecuador (el servidor corre en UTC: sin zona, un cupón que vence a las 23:59 saldría un día después). */
export function ecDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-EC', { timeZone: EC_TZ, day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

/** "30 nov, 14:05" en hora de Ecuador. */
export function ecDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('es-EC', { timeZone: EC_TZ, day: 'numeric', month: 'short' }).replace(/\./g, '');
  const time = d.toLocaleTimeString('es-EC', { timeZone: EC_TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}, ${time}`;
}

/** "Válido hasta el 30 nov 2026" o, si aún no empieza, "Válido del 1 dic 2026 al 15 dic 2026". */
export function validityText(startsAt: string, endsAt: string, nowMs: number = Date.now()): string {
  if (nowMs < Date.parse(startsAt)) return `Válido del ${ecDate(startsAt)} al ${ecDate(endsAt)}`;
  return `Válido hasta el ${ecDate(endsAt)}`;
}
