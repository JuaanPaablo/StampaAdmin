import { MONTHS } from '@/lib/format';

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MONTHS_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const RANGE_LABEL: Record<'7d' | '30d' | '90d', string> = { '7d': '7 días', '30d': '30 días', '90d': '90 días' };

/** Variación porcentual contra el periodo anterior. Más es mejor. */
export function delta(current: number, previous: number): { value: string; good: boolean } | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { value: 'Sin dato previo', good: true };
  const p = Math.round(((current - previous) / previous) * 100);
  if (p === 0) return { value: 'Sin cambio', good: true };
  // Con bases muy chicas (1 → 23) un porcentaje enorme no dice nada: se muestra el múltiplo.
  if (p >= 300) return { value: '×' + (Math.round((current / previous) * 10) / 10).toString().replace('.', ','), good: true };
  return { value: (p > 0 ? '+' : '−') + Math.abs(p) + ' %', good: p > 0 };
}

/** "2026-11-03" (o ISO completo) a "3 nov". */
export function dayLabel(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date;
  return d + ' ' + MONTHS[m - 1];
}

export function hourLabel(h: number): string { return h + ':00'; }

export function hourPhrase(h: number): string {
  return h === 1 ? 'la ' + hourLabel(h) : 'las ' + hourLabel(h);
}

/** Índice del valor más alto (el primero si hay empate). -1 si todo es cero. */
export function peakIndex(values: number[]): number {
  let best = -1; let max = 0;
  values.forEach((v, i) => { if (v > max) { max = v; best = i; } });
  return best;
}
