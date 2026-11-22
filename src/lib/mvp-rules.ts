import { randomBytes } from 'node:crypto';

/** Reglas compartidas del MVP (las usan el repo en memoria, el de Supabase y la interfaz). Sin dependencias de servidor salvo crypto. */

export const PLACEHOLDER_BUSINESS_NAME = 'Negocio nuevo';
export { PLANS, PLAN_LABEL } from './plans';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

/** Duración de la sesión del cliente en su teléfono (cookie `stampa_cliente`). */
export const CUSTOMER_SESSION_DAYS = 365;
/** Duración de la sesión del administrador (cookie `stampa_admin`). */
export const ADMIN_SESSION_HOURS = 12;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Slug provisional mientras el dueño no escribe el nombre real: "nuevo-3f9a1c". */
export function provisionalSlug(): string {
  return `nuevo-${randomBytes(3).toString('hex')}`;
}

export function validateBusinessImage(file: { bytes: Uint8Array; contentType: string }): string | null {
  if (!file || !file.bytes || file.bytes.byteLength === 0) return 'Elige una imagen.';
  if (!(IMAGE_TYPES as readonly string[]).includes(file.contentType)) return 'La imagen debe ser PNG, JPG o WEBP.';
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) return 'La imagen pesa más de 2 MB. Usa una más liviana.';
  if (!sniffImage(file.bytes, file.contentType)) return 'El archivo no parece una imagen válida.';
  return null;
}

/** Comprueba la firma real del archivo (no basta con el tipo que declara el navegador). */
export function sniffImage(b: Uint8Array, type: string): boolean {
  if (type === 'image/png') return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/webp') return b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return false;
}

/** Año de nacimiento opcional: entre hace 110 años y hace 5 años. */
export function validateBirthYear(year: number | undefined, nowMs: number = Date.now()): string | null {
  if (year === undefined) return null;
  const current = new Date(nowMs).getUTCFullYear();
  if (!Number.isInteger(year) || year < current - 110 || year > current - 5) return 'El año de nacimiento no es válido.';
  return null;
}

/** Estado efectivo de un negocio (los antiguos sin estado cuentan como activos). */
export function businessStatus(b: { status?: 'setup' | 'active' | 'suspended' }): 'setup' | 'active' | 'suspended' {
  return b.status ?? 'active';
}

/** Días hasta el vencimiento del plan (negativo = vencido), o null si no tiene fecha. */
export function daysToExpiry(planExpiresAt: string | undefined, nowMs: number = Date.now()): number | null {
  if (!planExpiresAt) return null;
  return Math.ceil((Date.parse(planExpiresAt) - nowMs) / 86_400_000);
}
