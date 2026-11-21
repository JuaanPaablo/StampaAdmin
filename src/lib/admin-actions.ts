'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { accessShareText, emailStatusOf, parseDateInput, type EmailStatus } from '@/components/admin/helpers';
import { sendAccessEmail } from './access-mail';
import type { AccessTokenKind, Plan } from './contracts';
import { normalizeEmail, validateEmail } from './credentials';
import { ipLimiter } from './login-throttle';
import { PLANS } from './mvp-rules';
import { MAX_PASSWORD_LENGTH, validatePassword } from './password';
import { getRepo } from './repo';
import { clearAdminSession, createAdminSession, requestIp, requireAdmin } from './admin-session';

/**
 * Server actions del panel de administrador. TODAS (salvo el inicio de sesión) llaman primero a requireAdmin().
 * Este archivo es 'use server': solo exporta funciones asíncronas y tipos.
 * El token en claro de una invitación solo viaja en la respuesta de la acción que lo emite: nunca va a la URL ni a logs.
 */

export type AdminLoginState = { error?: string; email?: string };

const GENERIC = 'Correo o contraseña incorrectos.';
const LOCKED = `${GENERIC} Inténtalo de nuevo en unos minutos.`;

export async function adminSignIn(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const rawEmail = formData.get('email');
  const email = normalizeEmail(rawEmail);
  const password = formData.get('password');
  const shown = typeof rawEmail === 'string' ? rawEmail.trim().slice(0, 254) : '';

  const ip = await requestIp();
  const limiter = ipLimiter();
  if (limiter.lockedFor(ip) > 0) return { error: LOCKED, email: shown };
  if (!email || typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    limiter.fail(ip);
    return { error: GENERIC, email: shown };
  }
  const repo = getRepo();
  let found: { adminId: string } | null;
  try {
    if (await repo.isAdminLoginLocked(email)) {
      limiter.fail(ip);
      return { error: LOCKED, email: shown };
    }
    found = await repo.verifyAdminCredentials(email, password);
    if (!found) {
      limiter.fail(ip);
      return { error: (await repo.isAdminLoginLocked(email)) ? LOCKED : GENERIC, email: shown };
    }
  } catch (e) {
    console.error('adminSignIn:', e instanceof Error ? e.message : e);
    return { error: 'No pudimos iniciar tu sesión en este momento. Inténtalo de nuevo en unos minutos.', email: shown };
  }
  await createAdminSession(found.adminId);
  redirect('/admin');
}

export async function adminSignOut(): Promise<void> {
  await clearAdminSession();
  redirect('/admin/ingresar');
}

/* ---------- Dar acceso a un negocio ---------- */

/** Resultado que la pantalla usa para mostrar el enlace (Copiar / WhatsApp) y el estado del correo. */
export type AccessLinkState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { status: 'ok'; url: string; kind: AccessTokenKind; shareText: string; emailStatus: EmailStatus; to: string; businessId: string };

const accessSchema = z.object({
  email: z.string().trim().max(254),
  plan: z.string(),
  expires: z.string().max(20).optional().default(''),
  note: z.string().max(500, 'La nota puede tener hasta 500 letras.').optional().default('')
});

export async function createAccessAction(_prev: AccessLinkState, formData: FormData): Promise<AccessLinkState> {
  const { repo } = await requireAdmin();
  const raw = {
    email: String(formData.get('email') ?? ''), plan: String(formData.get('plan') ?? ''),
    expires: String(formData.get('expires') ?? ''), note: String(formData.get('note') ?? '')
  };
  const values = { email: raw.email.slice(0, 254), plan: raw.plan.slice(0, 20), expires: raw.expires.slice(0, 20), note: raw.note.slice(0, 500) };
  const parsed = accessSchema.safeParse(raw);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message.startsWith('La ') ? i.message : 'Revisa este campo.';
    return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors, values };
  }
  const email = normalizeEmail(parsed.data.email);
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  if (!(PLANS as string[]).includes(parsed.data.plan)) fieldErrors.plan = 'Elige un plan.';
  const exp = parseDateInput(parsed.data.expires);
  if ('error' in exp) fieldErrors.expires = exp.error;
  if (Object.keys(fieldErrors).length > 0 || 'error' in exp) return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors, values };

  let created: Awaited<ReturnType<typeof repo.createBusinessAccess>>;
  try {
    created = await repo.createBusinessAccess({
      ownerEmail: email, plan: parsed.data.plan as Plan, planExpiresAt: exp.value ?? undefined, note: parsed.data.note.trim() || undefined
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/correo/i.test(msg)) return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors: { email: msg }, values };
    console.error('createAccessAction:', msg);
    return { status: 'error', error: msg || 'No pudimos crear el acceso. Inténtalo de nuevo.', values };
  }
  const { result, url } = await sendAccessEmail({ to: email, token: created.invite });
  revalidatePath('/admin', 'layout');
  return { status: 'ok', url, kind: 'invite', shareText: accessShareText('invite', url), emailStatus: emailStatusOf(result), to: email, businessId: created.business.id };
}

/** Reenvía el acceso al dueño: invitación si aún no crea su contraseña; si ya la tiene, enlace para cambiarla. */
export async function resendAccessAction(_prev: AccessLinkState, formData: FormData): Promise<AccessLinkState> {
  const { repo } = await requireAdmin();
  const id = String(formData.get('businessId') ?? '').slice(0, 128);
  const row = id ? await repo.getAdminBusiness(id) : null;
  if (!row) return { status: 'error', error: 'No encontramos ese negocio.' };
  if (!row.owner?.email) return { status: 'error', error: 'Este negocio no tiene un dueño con correo de acceso.' };
  const kind: AccessTokenKind = row.owner.invitePending ? 'invite' : 'reset';
  try {
    const token = await repo.issueAccessToken(row.owner.staffId, kind);
    const { result, url } = await sendAccessEmail({ to: row.owner.email, token });
    revalidatePath(`/admin/negocios/${row.business.id}`);
    return { status: 'ok', url, kind, shareText: accessShareText(kind, url), emailStatus: emailStatusOf(result), to: row.owner.email, businessId: row.business.id };
  } catch (e) {
    return { status: 'error', error: e instanceof Error && e.message ? e.message : 'No pudimos generar el enlace. Inténtalo de nuevo.' };
  }
}

/* ---------- Estado y plan ---------- */

export interface AdminActionResult { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }

export async function setStatusAction(formData: FormData): Promise<AdminActionResult> {
  const { repo } = await requireAdmin();
  const id = String(formData.get('businessId') ?? '').slice(0, 128);
  const status = formData.get('status');
  if (status !== 'active' && status !== 'suspended') return { ok: false, error: 'Acción no válida.' };
  try {
    const b = await repo.setBusinessStatus(id, status);
    revalidatePath('/admin', 'layout');
    return { ok: true, message: status === 'suspended' ? 'Negocio suspendido.' : b.status === 'setup' ? 'Negocio reactivado. Sigue configurando.' : 'Negocio reactivado.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pudimos cambiar el estado.' };
  }
}

export async function updatePlanAction(formData: FormData): Promise<AdminActionResult> {
  const { repo } = await requireAdmin();
  const id = String(formData.get('businessId') ?? '').slice(0, 128);
  const plan = String(formData.get('plan') ?? '');
  const note = String(formData.get('note') ?? '');
  const fieldErrors: Record<string, string> = {};
  if (!(PLANS as string[]).includes(plan)) fieldErrors.plan = 'Elige un plan.';
  const exp = parseDateInput(formData.get('expires'));
  if ('error' in exp) fieldErrors.expires = exp.error;
  if (note.length > 500) fieldErrors.note = 'La nota puede tener hasta 500 letras.';
  if (Object.keys(fieldErrors).length > 0 || 'error' in exp) return { ok: false, fieldErrors };
  try {
    await repo.updateBusinessPlan(id, plan as Plan, exp.value, note);
    revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Cambios guardados.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pudimos guardar los cambios.' };
  }
}

/* ---------- Mi cuenta ---------- */

export type PasswordState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export async function changeAdminPasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const { repo, admin } = await requireAdmin();
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.current = 'Escribe tu contraseña actual.';
  const pwErr = validatePassword(next);
  if (pwErr) fieldErrors.password = pwErr;
  else if (next !== confirm) fieldErrors.confirm = 'Las contraseñas no coinciden.';
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ip = await requestIp();
  const limiter = ipLimiter();
  if (limiter.lockedFor(ip) > 0) return { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' };
  try {
    await repo.changeAdminPassword(admin.id, current, next);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/actual/i.test(msg) && /correcta/i.test(msg)) { limiter.fail(ip); return { fieldErrors: { current: msg } }; }
    return { error: msg || 'No pudimos cambiar tu contraseña.' };
  }
  return { ok: true };
}
