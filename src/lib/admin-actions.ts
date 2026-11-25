'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { accessShareText, emailStatusOf, parseDateInput, type EmailStatus } from '@/components/admin/helpers';
import { sendAccessEmail } from './access-mail';
import type { AccessTokenKind, AdminPayment, NewAdminActionInput, PaymentMethod, Plan } from './contracts';
import { ecDayKey, parseAmountCents, validatePayment } from './domain/admin-insights';
import { normalizeEmail, validateEmail } from './credentials';
import { normalizeEcPhone } from './phone';
import { ipLimiter } from './login-throttle';
import { PLANS } from './mvp-rules';
import { MAX_PASSWORD_LENGTH, validatePassword } from './password';
import { getRepo, type Repo } from './repo';
import { clearAdminSession, createAdminSession, requestIp, requireAdmin } from './admin-session';

/**
 * Server actions del panel de administrador. TODAS (salvo el inicio de sesión) llaman primero a requireAdmin().
 * Este archivo es 'use server': solo exporta funciones asíncronas y tipos.
 * El token en claro de una invitación solo viaja en la respuesta de la acción que lo emite: nunca va a la URL ni a logs.
 */

export type AdminLoginState = { error?: string; email?: string };

/** Guarda una acción en el historial del negocio. Nunca hace fallar la acción principal. */
async function logAction(repo: Repo, input: NewAdminActionInput): Promise<void> {
  try {
    await repo.logAdminAction(input);
  } catch (e) {
    console.error('logAdminAction:', e instanceof Error ? e.message : e);
  }
}

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
  const { repo, admin } = await requireAdmin();
  const raw = {
    email: String(formData.get('email') ?? ''), plan: String(formData.get('plan') ?? ''),
    expires: String(formData.get('expires') ?? ''), note: String(formData.get('note') ?? '')
  };
  const autoRenew = formData.get('autoRenew') === 'on';
  const phoneRaw = String(formData.get('phone') ?? '').slice(0, 30);
  const values = {
    email: raw.email.slice(0, 254), plan: raw.plan.slice(0, 20), expires: raw.expires.slice(0, 20), note: raw.note.slice(0, 500),
    autoRenew: autoRenew ? 'on' : '', phone: phoneRaw
  };
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
  else if (exp.value && Date.parse(exp.value) < Date.now()) fieldErrors.expires = 'Elige hoy o una fecha futura.';
  else if (autoRenew && !exp.value) fieldErrors.expires = 'Para renovar cada mes, elige el primer vencimiento.';
  // Celular opcional: se valida ANTES de crear nada.
  let phone: string | null = null;
  if (phoneRaw.trim()) {
    const ph = normalizeEcPhone(phoneRaw);
    if (ph.ok) phone = ph.phone;
    else fieldErrors.phone = ph.error;
  }
  if (Object.keys(fieldErrors).length > 0 || 'error' in exp) return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors, values };

  let created: Awaited<ReturnType<typeof repo.createBusinessAccess>>;
  try {
    created = await repo.createBusinessAccess({
      ownerEmail: email, plan: parsed.data.plan as Plan, planExpiresAt: exp.value ?? undefined, note: parsed.data.note.trim() || undefined, autoRenew
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/correo/i.test(msg)) return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors: { email: msg }, values };
    console.error('createAccessAction:', msg);
    return { status: 'error', error: msg || 'No pudimos crear el acceso. Inténtalo de nuevo.', values };
  }
  await logAction(repo, {
    businessId: created.business.id, adminId: admin.id, kind: 'access_created',
    detail: { email, plan: parsed.data.plan, planExpiresAt: exp.value ?? null, autoRenew }
  });
  if (phone) {
    // El negocio ya existe: si guardar el celular falla, se avisa en el registro y se sigue (se puede agregar en la ficha).
    try {
      const saved = await repo.setOwnerPhone(created.business.id, phone);
      await logAction(repo, { businessId: created.business.id, adminId: admin.id, kind: 'phone_changed', detail: { from: null, to: saved } });
    } catch (e) {
      console.error('createAccessAction (celular):', e instanceof Error ? e.message : e);
    }
  }
  const { result, url } = await sendAccessEmail({ to: email, token: created.invite });
  revalidatePath('/admin', 'layout');
  return { status: 'ok', url, kind: 'invite', shareText: accessShareText('invite', url), emailStatus: emailStatusOf(result), to: email, businessId: created.business.id };
}

/** Reenvía el acceso al dueño: invitación si aún no crea su contraseña; si ya la tiene, enlace para cambiarla. */
export async function resendAccessAction(_prev: AccessLinkState, formData: FormData): Promise<AccessLinkState> {
  const { repo, admin } = await requireAdmin();
  const id = String(formData.get('businessId') ?? '').slice(0, 128);
  const row = id ? await repo.getAdminBusiness(id) : null;
  if (!row) return { status: 'error', error: 'No encontramos ese negocio.' };
  if (!row.owner?.email) return { status: 'error', error: 'Este negocio no tiene un dueño con correo de acceso.' };
  const kind: AccessTokenKind = row.owner.invitePending ? 'invite' : 'reset';
  try {
    const token = await repo.issueAccessToken(row.owner.staffId, kind);
    await logAction(repo, { businessId: row.business.id, adminId: admin.id, kind: 'access_resent', detail: { kind, email: row.owner.email } });
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
  const { repo, admin } = await requireAdmin();
  const id = String(formData.get('businessId') ?? '').slice(0, 128);
  const status = formData.get('status');
  if (status !== 'active' && status !== 'suspended') return { ok: false, error: 'Acción no válida.' };
  try {
    const b = await repo.setBusinessStatus(id, status);
    await logAction(repo, { businessId: id, adminId: admin.id, kind: status === 'suspended' ? 'suspended' : 'reactivated', detail: { status: b.status ?? 'active' } });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: status === 'suspended' ? 'Negocio suspendido.' : b.status === 'setup' ? 'Negocio reactivado. Sigue configurando.' : 'Negocio reactivado.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pudimos cambiar el estado.' };
  }
}

export async function updatePlanAction(formData: FormData): Promise<AdminActionResult> {
  const { repo, admin } = await requireAdmin();
  const id = String(formData.get('businessId') ?? '').slice(0, 128);
  const plan = String(formData.get('plan') ?? '');
  const note = String(formData.get('note') ?? '');
  const fieldErrors: Record<string, string> = {};
  if (!(PLANS as string[]).includes(plan)) fieldErrors.plan = 'Elige un plan.';
  const autoRenew = formData.get('autoRenew') === 'on';
  const exp = parseDateInput(formData.get('expires'));
  const unchanged = String(formData.get('expires') ?? '') === String(formData.get('currentExpires') ?? '');
  if ('error' in exp) fieldErrors.expires = exp.error;
  else if (exp.value && Date.parse(exp.value) < Date.now() && !unchanged) fieldErrors.expires = 'Elige hoy o una fecha futura.';
  else if (autoRenew && !exp.value) fieldErrors.expires = 'Para renovar cada mes, elige el próximo vencimiento.';
  if (note.length > 500) fieldErrors.note = 'La nota puede tener hasta 500 letras.';
  if (Object.keys(fieldErrors).length > 0 || 'error' in exp) return { ok: false, fieldErrors };
  try {
    const before = await repo.getAdminBusiness(id);
    const after = await repo.updateBusinessPlan(id, plan as Plan, exp.value, note, autoRenew);
    if (before) {
      const b = before.business;
      if (b.plan !== after.plan) await logAction(repo, { businessId: id, adminId: admin.id, kind: 'plan_changed', detail: { from: b.plan, to: after.plan } });
      const dayOf = (v?: string) => (v ? ecDayKey(v) : null);
      const expiryMoved = dayOf(b.planExpiresAt) !== dayOf(after.planExpiresAt);
      const renewChanged = !!b.autoRenew !== !!after.autoRenew;
      if (expiryMoved || renewChanged) {
        await logAction(repo, {
          businessId: id, adminId: admin.id, kind: 'expiry_changed',
          detail: { ...(expiryMoved ? { from: b.planExpiresAt ?? null, to: after.planExpiresAt ?? null } : {}), ...(renewChanged ? { autoRenew: !!after.autoRenew } : {}) }
        });
      }
      if ((before.note ?? '') !== note.trim().slice(0, 500)) await logAction(repo, { businessId: id, adminId: admin.id, kind: 'note_changed' });
    }
    revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Cambios guardados.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pudimos guardar los cambios.' };
  }
}

/* ---------- Cobros y celular del dueño ---------- */

/** Estado del formulario "Registrar pago" (useFormState). fieldErrors: amount, paidAt, method, months, newExpiresAt, note. */
export type PaymentFormState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string> }
  | { status: 'ok'; message: string; payment: AdminPayment; newExpiresAt: string };

/**
 * Registra un pago. Campos del formulario: businessId, amount ("54,99"), paidAt (AAAA-MM-DD), method
 * (transferencia | efectivo | tarjeta | otro), mode ('months' por defecto | 'date'), months (1..24), newExpires (AAAA-MM-DD), note.
 * Extiende el vencimiento y guarda la acción 'payment_recorded' (lo hace el repo). No reactiva el negocio.
 */
export async function recordPaymentAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { repo, admin } = await requireAdmin();
  const businessId = String(formData.get('businessId') ?? '').slice(0, 128);
  const amountCents = parseAmountCents(String(formData.get('amount') ?? '').slice(0, 20));
  const paidAt = String(formData.get('paidAt') ?? '').trim().slice(0, 10);
  const method = String(formData.get('method') ?? '') as PaymentMethod;
  const byDate = formData.get('mode') === 'date';
  const monthsRaw = String(formData.get('months') ?? '1').trim();
  const months = byDate ? undefined : Number(monthsRaw || '1');
  const newExpiresAt = byDate ? String(formData.get('newExpires') ?? '').trim().slice(0, 10) : undefined;
  const note = String(formData.get('note') ?? '').trim();
  if (!businessId) return { status: 'error', error: 'No encontramos ese negocio.' };
  if (byDate && !newExpiresAt) return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors: { newExpiresAt: 'Elige la nueva fecha de vencimiento.' } };
  const invalid = validatePayment({ amountCents, paidAt, method, months, newExpiresAt, note: note || undefined });
  if (invalid) return { status: 'error', error: 'Revisa los campos marcados.', fieldErrors: { [invalid.field]: invalid.error } };
  try {
    const { payment, business } = await repo.recordPayment({
      businessId, amountCents, paidAt, method, months, newExpiresAt, note: note || undefined, createdBy: admin.id
    });
    revalidatePath('/admin', 'layout');
    return { status: 'ok', message: 'Pago registrado.', payment, newExpiresAt: business.planExpiresAt ?? payment.newExpiresAt };
  } catch (e) {
    return { status: 'error', error: e instanceof Error && e.message ? e.message : 'No pudimos registrar el pago. Inténtalo de nuevo.' };
  }
}

/** Guarda o borra (campo vacío) el celular del dueño. Campos: businessId, phone. fieldErrors.phone si no es válido. */
export async function setOwnerPhoneAction(formData: FormData): Promise<AdminActionResult> {
  const { repo, admin } = await requireAdmin();
  const businessId = String(formData.get('businessId') ?? '').slice(0, 128);
  const raw = String(formData.get('phone') ?? '').slice(0, 30);
  const before = businessId ? await repo.getAdminBusiness(businessId) : null;
  if (!before) return { ok: false, error: 'No encontramos ese negocio.' };
  try {
    const saved = await repo.setOwnerPhone(businessId, raw.trim() ? raw : null);
    if ((before.ownerPhone ?? null) !== saved) {
      await logAction(repo, { businessId, adminId: admin.id, kind: 'phone_changed', detail: { from: before.ownerPhone ?? null, to: saved } });
    }
    revalidatePath('/admin', 'layout');
    return { ok: true, message: saved ? 'Celular guardado.' : 'Celular borrado.' };
  } catch (e) {
    const msg = e instanceof Error && e.message ? e.message : 'No pudimos guardar el celular.';
    return { ok: false, fieldErrors: { phone: msg } };
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
