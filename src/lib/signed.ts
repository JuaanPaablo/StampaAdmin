import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAuthSecret } from './session-token';

/**
 * Datos firmados genéricos (base64url(JSON) + '.' + base64url(HMAC-SHA256)) para las cookies nuevas del MVP:
 * `stampa_admin` (panel de administrador) y `stampa_cliente` (tarjeta del cliente). Cada uso lleva un `aud` distinto
 * para que un token de un tipo nunca valga como otro. La sesión del panel de negocios sigue en session-token.ts.
 */

export interface SignedBase { aud: string; iat: number; exp: number }

const b64u = (b: Buffer) => b.toString('base64url');
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest();

export function signData<T extends SignedBase>(payload: T, secret: string = getAuthSecret()): string {
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${b64u(mac(body, secret))}`;
}

/** Payload si la firma es válida, el `aud` coincide y no venció; si no, null. Nunca lanza. */
export function verifyData<T extends SignedBase>(token: string | undefined | null, aud: string, nowMs: number = Date.now(), secret: string = getAuthSecret()): T | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let given: Buffer;
  try { given = Buffer.from(sig, 'base64url'); } catch { return null; }
  const expected = mac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    if (!p || p.aud !== aud || typeof p.iat !== 'number' || typeof p.exp !== 'number') return null;
    if (p.exp * 1000 <= nowMs || p.iat * 1000 > nowMs + 60_000) return null;
    return p;
  } catch { return null; }
}

export function issued(seconds: number, nowMs: number = Date.now()): { iat: number; exp: number } {
  const iat = Math.floor(nowMs / 1000);
  return { iat, exp: iat + seconds };
}
