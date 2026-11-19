import type { RangeKey } from '../contracts';

/** Utilidades de fecha sin dependencias. Todo en milisegundos epoch; el "día local" se calcula con un desfase en minutos. */

export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;

const fmtCache = new Map<string, Intl.DateTimeFormat>();

/** Desfase (minutos, este = positivo) de una zona horaria IANA en un instante. Si la zona no existe devuelve Guayaquil (-300). */
export function tzOffsetMinutes(tz: string | undefined, at: Date | number = Date.now()): number {
  const name = tz || 'America/Guayaquil';
  try {
    let f = fmtCache.get(name);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: name, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      });
      fmtCache.set(name, f);
    }
    const t = typeof at === 'number' ? at : at.getTime();
    const p: Record<string, number> = {};
    for (const part of f.formatToParts(new Date(t))) if (part.type !== 'literal') p[part.type] = Number(part.value);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - Math.floor(t / 1000) * 1000) / MINUTE_MS);
  } catch {
    return -300;
  }
}

export interface LocalParts { y: number; m: number; d: number; h: number; min: number; wd: number }

/** Partes de fecha locales: m = 0..11, wd = 0 (domingo)..6. */
export function localParts(at: number | Date, offsetMin: number): LocalParts {
  const t = (typeof at === 'number' ? at : at.getTime()) + offsetMin * MINUTE_MS;
  const dt = new Date(t);
  return {
    y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(),
    h: dt.getUTCHours(), min: dt.getUTCMinutes(), wd: dt.getUTCDay()
  };
}

/** Epoch ms de la medianoche local del día que contiene `at`. */
export function localDayStart(at: number | Date, offsetMin: number): number {
  const t = typeof at === 'number' ? at : at.getTime();
  return Math.floor((t + offsetMin * MINUTE_MS) / DAY_MS) * DAY_MS - offsetMin * MINUTE_MS;
}

/** 'YYYY-MM-DD' en hora local. */
export function dayKey(at: number | Date, offsetMin: number): string {
  const p = localParts(at, offsetMin);
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function rangeDays(range: RangeKey): number {
  return range === '7d' ? 7 : range === '30d' ? 30 : 90;
}

export interface RangeBounds { days: number; start: number; end: number; prevStart: number }

/** Rango actual [start, end) alineado a días locales (incluye hoy) y el periodo anterior del mismo largo [prevStart, start). */
export function rangeBounds(range: RangeKey, now: number | Date, offsetMin: number): RangeBounds {
  const days = rangeDays(range);
  const today = localDayStart(now, offsetMin);
  const start = today - (days - 1) * DAY_MS;
  return { days, start, end: today + DAY_MS, prevStart: start - days * DAY_MS };
}

export function daysBetween(fromIso: string | number, to: number | Date): number {
  const f = typeof fromIso === 'number' ? fromIso : Date.parse(fromIso);
  return ((typeof to === 'number' ? to : to.getTime()) - f) / DAY_MS;
}
