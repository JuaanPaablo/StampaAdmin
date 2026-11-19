/** Formatos en español de Ecuador. Dinero en centavos. */
export function money(cents: number): string {
  return '$' + (cents / 100).toFixed(2).replace('.', ',');
}
export function parseMoney(input: string): number {
  const n = parseFloat(String(input).replace('$', '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
export function pct(n: number): string { return Math.round(n * 100) + ' %'; }
export function num(n: number, d = 0): string { return n.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }); }
export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
}
export function dateShort(iso: string): string { return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }); }
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}
export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Adapta al vocabulario del negocio los textos generados por el sistema que dicen "ticket"
 * (mensajes de alertas y del registro de actividad). Respeta el género: "el ticket" -> "la ficha".
 */
export function localizeTicket(text: string, word: string): string {
  const w = word.toLowerCase();
  if (w === 'ticket') return text;
  const fem = ['ficha', 'factura', 'cuenta'].includes(w);
  const plural = w.endsWith('a') ? w + 's' : w + 'es';
  const art = (m: string, f: string) => (fem ? f : m);
  return text
    .replace(/\b(Un|un) ticket\b/g, (_, a: string) => (fem ? (a === 'Un' ? 'Una ' : 'una ') : a + ' ') + w)
    .replace(/\b(El|el) ticket\b/g, (_, a: string) => (fem ? (a === 'El' ? 'La ' : 'la ') : a + ' ') + w)
    .replace(/\botro ticket\b/g, art('otro ', 'otra ') + w)
    .replace(/\bdel ticket\b/g, fem ? 'de la ' + w : 'del ' + w)
    .replace(/\bal ticket\b/g, fem ? 'a la ' + w : 'al ' + w)
    .replace(/\btickets\b/g, plural)
    .replace(/\bTickets\b/g, plural.charAt(0).toUpperCase() + plural.slice(1))
    .replace(/\bticket\b/g, w);
}
