import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token de sesión firmado (lógica pura, sin cookies). Formato: base64url(JSON payload) + '.' + base64url(HMAC-SHA256).
 * Lo usan session.ts (cookie) y las pruebas.
 */

export interface SessionPayload { businessId: string; staffId: string; iat: number; exp: number }

export const SESSION_COOKIE = 'stampa_session';
export const SESSION_SECONDS = 60 * 60 * 12;
export const REMEMBER_SECONDS = 60 * 60 * 24 * 30;

const DEV_SECRET = 'stampa-dev-only-secret-do-not-use-in-production';

/** AUTH_SECRET en producción es obligatorio (mínimo 32 caracteres). En desarrollo y pruebas hay un secreto fijo. */
export function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!s || s.length < 32) throw new Error('Falta AUTH_SECRET (mínimo 32 caracteres). Genéralo con: openssl rand -base64 32');
    return s;
  }
  return s && s.length > 0 ? s : DEV_SECRET;
}

const b64u = (b: Buffer) => b.toString('base64url');
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest();

export function signToken(payload: SessionPayload, secret: string = getAuthSecret()): string {
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${b64u(mac(body, secret))}`;
}

/** Devuelve el payload si la firma es válida y no venció; si no, null. Nunca lanza por un token mal formado. */
export function verifyToken(token: string | undefined | null, nowMs: number = Date.now(), secret: string = getAuthSecret()): SessionPayload | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let given: Buffer;
  try { given = Buffer.from(sig, 'base64url'); } catch { return null; }
  const expected = mac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (typeof p.businessId !== 'string' || typeof p.staffId !== 'string' || typeof p.iat !== 'number' || typeof p.exp !== 'number') return null;
    if (p.exp * 1000 <= nowMs || p.iat * 1000 > nowMs + 60_000) return null;
    return { businessId: p.businessId, staffId: p.staffId, iat: p.iat, exp: p.exp };
  } catch { return null; }
}

export function newPayload(businessId: string, staffId: string, remember: boolean, nowMs: number = Date.now()): SessionPayload {
  const iat = Math.floor(nowMs / 1000);
  return { businessId, staffId, iat, exp: iat + (remember ? REMEMBER_SECONDS : SESSION_SECONDS) };
}
