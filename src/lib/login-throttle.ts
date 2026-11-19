/**
 * Límites de intentos en memoria del proceso (best-effort; con varias instancias cada una cuenta aparte).
 * - Por cuenta (correo): 5 fallos seguidos bloquean 15 minutos. Se usa para correos que no existen y en el repo en memoria.
 * - Por IP: máximo 20 fallos en 15 minutos.
 */

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const LOCK_MS = LOCK_MINUTES * 60_000;

export class AttemptLimiter {
  private m = new Map<string, { n: number; first: number; until: number }>();
  constructor(private max: number, private windowMs: number, private maxKeys = 10_000) {}

  /** Milisegundos restantes de bloqueo (0 = libre). */
  lockedFor(key: string, now = Date.now()): number {
    const e = this.m.get(key);
    return e && e.until > now ? e.until - now : 0;
  }
  fail(key: string, now = Date.now()): void {
    if (this.m.size >= this.maxKeys) this.sweep(now);
    let e = this.m.get(key);
    if (!e || (e.until === 0 && now - e.first > this.windowMs) || (e.until !== 0 && e.until <= now)) e = { n: 0, first: now, until: 0 };
    e.n++;
    if (e.n >= this.max) { e.until = now + this.windowMs; e.n = 0; e.first = now; }
    this.m.set(key, e);
  }
  reset(key: string): void { this.m.delete(key); }
  private sweep(now: number) {
    for (const [k, e] of this.m) if (e.until <= now && now - e.first > this.windowMs) this.m.delete(k);
    if (this.m.size >= this.maxKeys) this.m.clear();
  }
}

const g = globalThis as unknown as { __stampaIpLimiter?: AttemptLimiter };
export const ipLimiter = (): AttemptLimiter => (g.__stampaIpLimiter ??= new AttemptLimiter(20, LOCK_MS));
