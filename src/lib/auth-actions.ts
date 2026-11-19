'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MAX_PASSWORD_LENGTH } from './password';
import { normalizeEmail } from './credentials';
import { ipLimiter } from './login-throttle';
import { getRepo } from './repo';
import { safeNext } from './safe-next';
import { clearSession, createSession } from './session';

/**
 * Server actions de acceso. Importa `signIn` y `signOut` desde '@/lib/auth' (reexporta este archivo).
 * Este archivo es 'use server': solo puede exportar funciones asíncronas y tipos.
 */

export type LoginState = { error?: string; email?: string };

const GENERIC = 'Correo o contraseña incorrectos.';
const LOCKED = `${GENERIC} Inténtalo de nuevo en unos minutos.`;

async function clientIp(): Promise<string> {
  const h = await Promise.resolve(headers());
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim().slice(0, 64) || 'unknown';
}

/** Campos del formulario: email, password, remember ("on", opcional) y next (opcional, debe empezar por /panel). */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get('email');
  const email = normalizeEmail(rawEmail);
  const password = formData.get('password');
  const remember = formData.get('remember') === 'on';
  const next = safeNext(formData.get('next'));
  const shown = typeof rawEmail === 'string' ? rawEmail.trim().slice(0, 254) : '';

  const ip = await clientIp();
  const limiter = ipLimiter();
  if (limiter.lockedFor(ip) > 0) return { error: LOCKED, email: shown };
  if (!email || typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    limiter.fail(ip);
    return { error: GENERIC, email: shown };
  }

  const repo = getRepo();
  let found: { businessId: string; staffId: string } | null;
  try {
    found = await repo.verifyCredentials(email, password);
    if (!found) {
      limiter.fail(ip);
      return { error: (await repo.isLoginLocked(email)) ? LOCKED : GENERIC, email: shown };
    }
  } catch (e) {
    console.error('signIn:', e instanceof Error ? e.message : e);
    return { error: 'No pudimos iniciar tu sesión en este momento. Inténtalo de nuevo en unos minutos.', email: shown };
  }
  await createSession(found.businessId, found.staffId, remember);
  redirect(next);
}

/** Borra la sesión y vuelve a /ingresar. */
export async function signOut(): Promise<void> {
  await clearSession();
  redirect('/ingresar');
}
