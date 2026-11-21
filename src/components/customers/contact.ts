import type { ContactKind } from '@/lib/contracts';

/** Normaliza un número de WhatsApp a solo dígitos con código de país (Ecuador por defecto). null si no es válido. */
export function normalizeWhatsapp(input: string): string | null {
  const raw = input.trim();
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) { /* ya trae código de país */ }
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 10) d = '593' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** Solo dígitos para wa.me. Tolera números guardados sin código de país. */
export function waDigits(contact: string): string {
  return normalizeWhatsapp(contact) ?? contact.replace(/\D/g, '');
}

export function contactHref(kind: ContactKind, contact: string): string {
  return kind === 'whatsapp' ? `https://wa.me/${waDigits(contact)}` : `mailto:${contact}`;
}

export const contactLabel = (k: ContactKind) => (k === 'whatsapp' ? 'WhatsApp' : 'Correo');

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "3 de mayo de 1990" si hay año; "3 de mayo" si no; null sin cumpleaños. */
export function birthdayLabel(c: { birthday?: { d: number; m: number }; birthdayYear?: number }): string | null {
  if (!c.birthday) return null;
  const base = `${c.birthday.d} de ${MONTHS[c.birthday.m] ?? ''}`;
  return c.birthdayYear ? `${base} de ${c.birthdayYear}` : base;
}
