/** Utilidades de texto en español (Ecuador). Sin dependencias del resto del dominio. */

/** Un ticket se compara sin espacios sobrantes ni mayúsculas: "a-100 " y "A-100" son el mismo ticket. */
export function normalizeTicket(t: string): string {
  return t.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** 250 -> "$2,50". Miles con punto: 123456 -> "$1.234,56". */
export function formatMoneyEs(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}$${whole},${String(abs % 100).padStart(2, '0')}`;
}

export function cupos(n: number): string {
  return `${n} ${n === 1 ? 'cupo' : 'cupos'}`;
}

/** Minúsculas y sin tildes, para búsquedas. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function slugify(s: string): string {
  return foldText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'negocio';
}

/** "Café La Esquina" -> "CL"; una sola palabra -> sus dos primeras letras. */
export function initials(name: string): string {
  const words = foldText(name).split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  const stop = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'y']);
  const main = words.filter((w) => !stop.has(w));
  const use = main.length ? main : words;
  if (use.length >= 2) return (use[0][0] + use[1][0]).toUpperCase();
  return (use[0] ?? 'ST').slice(0, 2).toUpperCase();
}

/** Número con coma decimal: 2.444 -> "2,4". */
export function num1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}
