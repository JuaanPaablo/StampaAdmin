'use server';

import { sendAccessEmail } from '@/lib/access-mail';
import { requestIp } from '@/lib/admin-session';
import { normalizeEmail, validateEmail } from '@/lib/credentials';
import { emailPreviewEnabled } from '@/lib/email';
import { AttemptLimiter } from '@/lib/login-throttle';
import { getRepo } from '@/lib/repo';

/**
 * "¿Olvidaste tu contraseña?". SIEMPRE responde lo mismo, exista o no el correo, y tarda al menos MIN_MS para que el
 * tiempo de respuesta tampoco lo revele. Solo en modo de prueba de correo (sin Resend) devuelve el enlace para mostrarlo.
 */

export type ForgotState = { done?: boolean; error?: string; previewUrl?: string; email?: string };

const MIN_MS = 900;
const g = globalThis as unknown as { __stampaForgotIp?: AttemptLimiter; __stampaForgotEmail?: AttemptLimiter };
/** Por IP: 5 pedidos cada 15 minutos. Por correo: 3 enlaces por hora (evita llenar la bandeja de alguien). */
const ipLimit = () => (g.__stampaForgotIp ??= new AttemptLimiter(5, 15 * 60_000));
const emailLimit = () => (g.__stampaForgotEmail ??= new AttemptLimiter(3, 60 * 60_000));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const started = Date.now();
  const raw = formData.get('email');
  const email = normalizeEmail(raw);
  const shown = typeof raw === 'string' ? raw.trim().slice(0, 254) : '';
  if (validateEmail(email)) return { error: 'Escribe un correo válido.', email: shown };

  const ip = await requestIp();
  if (ipLimit().lockedFor(ip) > 0) return { error: 'Hiciste muchos pedidos seguidos. Inténtalo de nuevo en unos minutos.', email: shown };
  ipLimit().fail(ip);

  let previewUrl: string | undefined;
  try {
    if (emailLimit().lockedFor(email) === 0) {
      emailLimit().fail(email);
      const repo = getRepo();
      const staff = await repo.findStaffByEmail(email);
      if (staff?.email) {
        const token = await repo.issueAccessToken(staff.id, 'reset');
        const { result, url } = await sendAccessEmail({ to: staff.email, token });
        if (!result.sent && result.preview && emailPreviewEnabled()) previewUrl = url;
      }
    }
  } catch (e) {
    // No se revela nada al usuario; tampoco se registra el correo ni el enlace.
    console.error('requestPasswordReset:', e instanceof Error ? e.message : 'error');
  }
  const elapsed = Date.now() - started;
  if (elapsed < MIN_MS) await wait(MIN_MS - elapsed);
  return { done: true, previewUrl, email: shown };
}
