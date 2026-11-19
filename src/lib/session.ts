import { cookies } from 'next/headers';
import { REMEMBER_SECONDS, SESSION_COOKIE, SESSION_SECONDS, newPayload, signToken, verifyToken, type SessionPayload } from './session-token';

/** Sesión del panel en una cookie firmada (solo servidor). Ver session-token.ts para el formato. */

export type { SessionPayload };

/** Crea la cookie de sesión. Con `remember` dura 30 días; si no, 12 horas. */
export async function createSession(businessId: string, staffId: string, remember = false): Promise<void> {
  const jar = await Promise.resolve(cookies());
  const payload = newPayload(businessId, staffId, remember);
  jar.set(SESSION_COOKIE, signToken(payload), {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
    maxAge: remember ? REMEMBER_SECONDS : SESSION_SECONDS
  });
}

/** Sesión válida (firma y vigencia) o null. No consulta la base: getContext() comprueba que la persona siga activa. */
export async function readSession(): Promise<SessionPayload | null> {
  const jar = await Promise.resolve(cookies());
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export async function clearSession(): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
}
