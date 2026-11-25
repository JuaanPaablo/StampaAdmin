/**
 * Celulares de Ecuador (para escribir al dueño por WhatsApp). Puro y seguro para el navegador.
 * Se aceptan "0991234567", "099 123 4567", "+593 99 123 4567", "593991234567" y "991234567" (con espacios, guiones,
 * puntos o paréntesis). Siempre se guarda en E.164: "+593991234567". Solo celulares (09…): WhatsApp no sirve con fijos.
 */

export const EC_PHONE_E164_RE = /^\+5939\d{8}$/;

export type PhoneResult = { ok: true; phone: string } | { ok: false; error: string };

export const PHONE_ERROR = 'Escribe un celular de Ecuador: 09 y 8 números más (por ejemplo 099 123 4567).';

/** Valida y normaliza a E.164. Vacío = error (para borrar el teléfono usa null en setOwnerPhone). */
export function normalizeEcPhone(raw: unknown): PhoneResult {
  if (typeof raw !== 'string') return { ok: false, error: PHONE_ERROR };
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 30) return { ok: false, error: PHONE_ERROR };
  if (/[^\d\s+().-]/.test(trimmed)) return { ok: false, error: PHONE_ERROR };
  const plus = trimmed.startsWith('+');
  if (trimmed.slice(1).includes('+')) return { ok: false, error: PHONE_ERROR };
  const digits = trimmed.replace(/\D/g, '');
  let national: string | null = null;
  if (plus || digits.startsWith('593')) {
    if (digits.startsWith('5930') && digits.length === 13) national = digits.slice(4);   // +593 099 123 4567
    else if (digits.startsWith('593') && digits.length === 12) national = digits.slice(3);
  } else if (digits.length === 10 && digits.startsWith('0')) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  if (!national || !/^9\d{8}$/.test(national)) return { ok: false, error: PHONE_ERROR };
  return { ok: true, phone: `+593${national}` };
}

/** true si es un celular de Ecuador válido en cualquier formato aceptado. */
export function isEcPhone(raw: unknown): boolean {
  return normalizeEcPhone(raw).ok;
}

/** "+593 99 123 4567" para mostrar. Si no es un E.164 de Ecuador, devuelve el texto tal cual. */
export function formatEcPhone(e164: string | undefined | null): string {
  if (!e164) return '';
  if (!EC_PHONE_E164_RE.test(e164)) return e164;
  const n = e164.slice(4);
  return `+593 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}

/** "099 123 4567" (formato local) para un campo de texto. */
export function localEcPhone(e164: string | undefined | null): string {
  if (!e164 || !EC_PHONE_E164_RE.test(e164)) return e164 ?? '';
  const n = e164.slice(4);
  return `0${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}
