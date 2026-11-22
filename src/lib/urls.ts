/**
 * Direcciones públicas de la app. Todo enlace que sale de la app (QR, correos, WhatsApp) se arma aquí.
 * NEXT_PUBLIC_APP_URL = https://stampaecu.app en producción (sin barra final).
 * IMPORTANTE: el QR del póster usa customerUrl(slug). Cambiar este formato invalida los pósters impresos.
 */

export const STAMPA_WHATSAPP = '593990916553'; // +593 99 091 6553, ventas y cobros de Stampa
export const STAMPA_WHATSAPP_DISPLAY = '+593 99 091 6553';

export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return raw.replace(/\/+$/, '');
}

/** Página pública del negocio: alta del cliente y su tarjeta. Es lo que codifica el QR del póster. */
export const customerPath = (slug: string) => `/u/${encodeURIComponent(slug)}`;
export const customerUrl = (slug: string) => `${appUrl()}${customerPath(slug)}`;

/** Lo que codifica el QR de la pantalla de Caja: abre la tarjeta del cliente y reclama ese código. */
export const stampPath = (slug: string, code: string) => `${customerPath(slug)}/sello?c=${encodeURIComponent(code)}`;
export const stampUrl = (slug: string, code: string) => `${appUrl()}${stampPath(slug, code)}`;

/** Invitación (crear contraseña) y restablecer contraseña. */
export const invitePath = (token: string) => `/invitacion/${token}`;
export const inviteUrl = (token: string) => `${appUrl()}${invitePath(token)}`;
export const resetPath = (token: string) => `/restablecer/${token}`;
export const resetUrl = (token: string) => `${appUrl()}${resetPath(token)}`;

/** Enlace de WhatsApp a Stampa con un mensaje prellenado. */
export function stampaWhatsappUrl(text: string): string {
  return `https://wa.me/${STAMPA_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/** Enlace para compartir un texto por WhatsApp a cualquier contacto (lo elige quien lo abre). */
export function shareWhatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
