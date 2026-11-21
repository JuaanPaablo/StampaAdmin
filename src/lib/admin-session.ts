import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminAccount } from './contracts';
import { ADMIN_SESSION_HOURS } from './mvp-rules';
import { getRepo, type Repo } from './repo';
import { issued, signData, verifyData, type SignedBase } from './signed';

/**
 * Sesión del panel de administrador de Stampa (solo servidor). Cookie `stampa_admin`, firmada con aud 'admin'.
 * Es totalmente independiente de `stampa_session` (panel de negocios): un token de un tipo nunca vale como el otro.
 */

export const ADMIN_COOKIE = 'stampa_admin';
export const ADMIN_AUD = 'admin';
export const ADMIN_SESSION_SECONDS = ADMIN_SESSION_HOURS * 3600;
export const ADMIN_LOGIN_PATH = '/admin/ingresar';

export interface AdminSessionPayload extends SignedBase { adminId: string }

/* ---------- Lógica pura (probada en admin-session.test.ts) ---------- */

export function signAdminToken(adminId: string, nowMs: number = Date.now(), secret?: string): string {
  const payload: AdminSessionPayload = { aud: ADMIN_AUD, adminId, ...issued(ADMIN_SESSION_SECONDS, nowMs) };
  return secret ? signData(payload, secret) : signData(payload);
}

/** adminId si el token es válido (firma, aud 'admin', vigencia y forma del payload); si no, null. Nunca lanza. */
export function verifyAdminToken(token: string | undefined | null, nowMs: number = Date.now(), secret?: string): string | null {
  const p = secret ? verifyData<AdminSessionPayload>(token, ADMIN_AUD, nowMs, secret) : verifyData<AdminSessionPayload>(token, ADMIN_AUD, nowMs);
  if (!p || typeof p.adminId !== 'string' || p.adminId.length === 0 || p.adminId.length > 128) return null;
  return p.adminId;
}

/* ---------- Cookie ---------- */

const cookieOptions = (maxAge: number) => ({
  httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production', maxAge
});

export async function createAdminSession(adminId: string): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(ADMIN_COOKIE, signAdminToken(adminId), cookieOptions(ADMIN_SESSION_SECONDS));
}

export async function clearAdminSession(): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(ADMIN_COOKIE, '', cookieOptions(0));
}

/** adminId de la cookie (solo firma y vigencia; no consulta la base). */
export async function readAdminSession(): Promise<string | null> {
  const jar = await Promise.resolve(cookies());
  return verifyAdminToken(jar.get(ADMIN_COOKIE)?.value);
}

/** Admin de la sesión si la cookie es válida y la cuenta existe; si no, null. */
export async function getAdminSession(): Promise<{ repo: Repo; admin: AdminAccount } | null> {
  const adminId = await readAdminSession();
  if (!adminId) return null;
  const repo = getRepo();
  const admin = await repo.getAdmin(adminId);
  return admin ? { repo, admin } : null;
}

/** Para TODA página y server action de /admin. Sin sesión válida o admin inexistente → /admin/ingresar. */
export async function requireAdmin(): Promise<{ repo: Repo; admin: AdminAccount }> {
  const s = await getAdminSession();
  if (!s) redirect(ADMIN_LOGIN_PATH);
  return s;
}

/** IP del cliente para los limitadores en memoria. */
export async function requestIp(): Promise<string> {
  const h = await Promise.resolve(headers());
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim().slice(0, 64) || 'unknown';
}
