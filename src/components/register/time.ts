/** Horas en la zona del negocio (el servidor puede estar en UTC). */
const DEFAULT_TZ = 'America/Guayaquil';

export function clock(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
}

export function dayClock(iso: string, tz: string = DEFAULT_TZ): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', timeZone: tz });
  return day + ', ' + clock(iso, tz);
}

/** AAAA-MM-DD HH:mm en la zona del negocio, para CSV. */
export function isoLocal(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleString('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function plural(s: string): string {
  return s.endsWith('s') ? s : s + 's';
}

/** "123456" -> "123 456" */
export function groupCode(code: string): string {
  return code.length === 6 ? code.slice(0, 3) + ' ' + code.slice(3) : code;
}

export function humanMinutes(min: number): string {
  if (min <= 0) return 'sin límite';
  if (min < 60) return min + ' min';
  if (min % 1440 === 0) { const d = min / 1440; return d === 1 ? '1 día' : d + ' días'; }
  if (min % 60 === 0) return min / 60 + ' h';
  return Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}

export function humanSeconds(sec: number): string {
  if (sec < 60) return sec + ' s';
  const m = Math.round(sec / 60);
  return m + ' min';
}
