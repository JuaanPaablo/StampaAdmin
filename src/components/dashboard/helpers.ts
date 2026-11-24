import { MONTHS } from '@/lib/format';

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MONTHS_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const RANGE_LABEL: Record<'7d' | '30d' | '90d', string> = { '7d': '7 días', '30d': '30 días', '90d': '90 días' };

export const RANGE_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 };

/** Dirección del cambio: sube, baja, igual o sin base para comparar. */
export type DeltaDir = 'up' | 'down' | 'flat' | 'new';
export interface Delta { value: string; good: boolean; dir: DeltaDir; words: string }

/**
 * Variación porcentual contra el periodo anterior. Más es mejor.
 * `value` es la cifra corta para la tarjeta; `words` la misma idea en palabras (para lectores de pantalla y frases).
 */
export function delta(current: number, previous: number): Delta | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { value: 'antes 0', good: true, dir: 'new', words: 'sin movimiento en el periodo anterior' };
  const p = Math.round(((current - previous) / previous) * 100);
  if (p === 0) return { value: 'igual', good: true, dir: 'flat', words: 'igual que el periodo anterior' };
  // Con bases muy chicas (1 → 23) un porcentaje enorme no dice nada: se muestra el múltiplo.
  if (p >= 300) {
    const x = (Math.round((current / previous) * 10) / 10).toString().replace('.', ',');
    return { value: '×' + x, good: true, dir: 'up', words: x + ' veces lo que hubo en el periodo anterior' };
  }
  return p > 0
    ? { value: p + ' %', good: true, dir: 'up', words: p + ' % más que el periodo anterior' }
    : { value: Math.abs(p) + ' %', good: false, dir: 'down', words: Math.abs(p) + ' % menos que el periodo anterior' };
}

/** "los 30 días anteriores": para decir contra qué se compara. */
export function previousLabel(range: '7d' | '30d' | '90d'): string {
  return 'los ' + RANGE_DAYS[range] + ' días anteriores';
}

/** "3 nov – 2 dic" para un rango que termina hoy. */
export function rangeDates(range: '7d' | '30d' | '90d', timezone?: string, now: Date = new Date()): string {
  const start = new Date(now.getTime() - (RANGE_DAYS[range] - 1) * 86_400_000);
  const f = (d: Date) => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      return dayLabel(parts);
    } catch {
      return d.getDate() + ' ' + MONTHS[d.getMonth()];
    }
  };
  return f(start) + ' – ' + f(now);
}

/** "2026-11-03" (o ISO completo) a "3 nov". */
export function dayLabel(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date;
  return d + ' ' + MONTHS[m - 1];
}

export function hourLabel(h: number): string { return h + ':00'; }

/** Etiqueta corta del eje de horas: "9h", "13h". */
export function hourTick(h: number): string { return h + 'h'; }

export function hourPhrase(h: number): string {
  return h === 1 ? 'la ' + hourLabel(h) : 'las ' + hourLabel(h);
}

/** Índice del valor más alto (el primero si hay empate). -1 si todo es cero. */
export function peakIndex(values: number[]): number {
  let best = -1; let max = 0;
  values.forEach((v, i) => { if (v > max) { max = v; best = i; } });
  return best;
}
