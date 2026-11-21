'use server';

import { redirect } from 'next/navigation';
import { requestIp } from '@/lib/admin-session';
import { ipLimiter } from '@/lib/login-throttle';
import { validatePassword } from '@/lib/password';
import { getRepo } from '@/lib/repo';
import { createSession } from '@/lib/session';
import { isTokenShape } from '@/lib/tokens';
import { validateName } from '@/lib/domain/validation';

/**
 * Crear (invitación) o cambiar (restablecer) la contraseña con un enlace de un solo uso, y entrar al panel.
 * Lo usan /invitacion/[token] y /restablecer/[token]. El token nunca se registra en logs.
 */

export type SetPasswordState = { expired?: boolean; error?: string; fieldErrors?: Record<string, string>; name?: string };

export async function setPasswordWithToken(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const token = formData.get('token');
  const mode = formData.get('mode') === 'reset' ? 'reset' : 'invite';
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const rawName = mode === 'invite' ? String(formData.get('name') ?? '').slice(0, 120) : undefined;
  if (!isTokenShape(token)) return { expired: true };

  const fieldErrors: Record<string, string> = {};
  if (rawName !== undefined) { const e = validateName(rawName); if (e) fieldErrors.name = e; }
  const pwErr = validatePassword(password);
  if (pwErr) fieldErrors.password = pwErr;
  else if (password !== confirm) fieldErrors.confirm = 'Las contraseñas no coinciden.';
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, name: rawName };

  const ip = await requestIp();
  const limiter = ipLimiter();
  if (limiter.lockedFor(ip) > 0) return { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.', name: rawName };

  const repo = getRepo();
  const info = await repo.peekAccessToken(token);
  if (!info || info.kind !== mode) { limiter.fail(ip); return { expired: true }; }

  let session: { businessId: string; staffId: string };
  try {
    session = await repo.consumeAccessToken(token, password, rawName?.trim());
  } catch (e) {
    if (!(await repo.peekAccessToken(token))) return { expired: true };
    return { error: e instanceof Error && e.message ? e.message : 'No pudimos guardar tu contraseña. Inténtalo de nuevo.', name: rawName };
  }
  await createSession(session.businessId, session.staffId);
  redirect('/panel');
}
