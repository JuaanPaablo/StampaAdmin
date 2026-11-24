'use server';

import { publicPreviewBlocked } from '@/lib/email';
import { redirect, RedirectType } from 'next/navigation';
import { z } from 'zod';
import { sendOtpEmail } from '@/lib/access-mail';
import type { Business } from '@/lib/contracts';
import { normalizeEmail, validateEmail } from '@/lib/credentials';
import {
  clearCustomerSession, clearPendingSignup, createCustomerSession, readCustomerSession, readPendingSignup, savePendingSignup,
  type PendingSignup
} from '@/lib/customer-session';
import { businessStatus } from '@/lib/mvp-rules';
import { getRepo } from '@/lib/repo';
import { syncWalletPass } from '@/lib/wallet/sync';
import { customerPath, stampPath } from '@/lib/urls';
import { checkBirthdate, cleanCode } from '@/components/customer/card-model';
import { claimLimiter, clientIp, otpRequestLimiter, otpVerifyLimiter } from '@/components/customer/throttle';
import type { FlowField, FlowState, SimpleState } from '@/components/customer/types';

/**
 * Server actions de la tarjeta del cliente (/u/<slug>, /u/<slug>/sello y /mis-tarjetas).
 * Todo se valida aquí: los datos del alta viajan firmados en la cookie `stampa_cliente_pendiente` mientras el cliente
 * escribe el código, y el correo de la sesión sale solo de la cookie firmada `stampa_cliente`.
 */

const GENERIC = 'Algo salió mal. Inténtalo de nuevo en unos minutos.';
const SEND_FAILED = 'No pudimos enviarte el código. Inténtalo de nuevo en unos minutos.';
const PREVIEW_EXISTING = 'Este correo ya tiene tarjeta. Por ahora ábrela desde el teléfono donde te registraste.';
/** "Espera 12 minutos": el tiempo que el límite ya calculó, para que el cliente sepa cuánto esperar. */
const waitText = (ms: number) => {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
};
const tooMany = (ms: number) => `Pediste demasiados códigos. Espera ${waitText(ms)} y vuelve a intentarlo.`;
const BAD_CODE = 'Ese código no coincide o ya venció. Copia los 6 números del último correo o toca "Reenviar código".';
const EXPIRED = 'Pasó demasiado tiempo. Escribe tu correo otra vez y te enviamos un código nuevo.';
const NOT_OPEN = 'Este negocio no está recibiendo clientes nuevos por ahora.';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};
const intOrNaN = (s: string) => (/^\d{1,4}$/.test(s.trim()) ? Number(s.trim()) : NaN);

const slugSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
const nameSchema = z.string().trim().min(2, 'Escribe tu nombre (al menos 2 letras).').max(80, 'Tu nombre es demasiado largo (máximo 80 letras).');

async function businessFor(slugRaw: string): Promise<Business | null> {
  const s = slugSchema.safeParse(slugRaw);
  if (!s.success) return null;
  return getRepo().getBusinessBySlug(s.data);
}

type Profile = { name: string; birthday: { d: number; m: number }; year: number };

/** Nombre, fecha de nacimiento y consentimiento del formulario. */
function readProfile(fd: FormData): { ok: true; value: Profile } | { ok: false; fieldErrors: Partial<Record<FlowField, string>> } {
  const errors: Partial<Record<FlowField, string>> = {};
  const name = nameSchema.safeParse(str(fd, 'name'));
  if (!name.success) errors.name = name.error.issues[0]?.message;
  const birth = checkBirthdate(intOrNaN(str(fd, 'day')), intOrNaN(str(fd, 'month')), intOrNaN(str(fd, 'year')));
  if (!birth.ok) errors.birth = birth.error;
  if (str(fd, 'consent') !== 'on') errors.consent = 'Para crear tu tarjeta necesitamos que aceptes el tratamiento de tus datos.';
  if (!name.success || !birth.ok || errors.consent) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { name: name.data.replace(/\s+/g, ' '), birthday: birth.birthday, year: birth.year } };
}

/** Pide el código al repo y lo envía. Devuelve el estado de la pantalla "Te enviamos un código". */
async function issueAndSend(pending: PendingSignup, businessName: string | undefined, notice?: string): Promise<FlowState> {
  const base: FlowState = { step: 'code', mode: pending.mode, email: pending.email, nonce: Date.now() };
  const ip = await clientIp();
  const limiter = otpRequestLimiter();
  const locked = limiter.lockedFor(ip);
  if (locked > 0) return { ...base, step: 'form', error: tooMany(locked) };
  limiter.fail(ip);

  const repo = getRepo();
  // Producción sin Resend: el código se mostraría en pantalla. Solo se permite para correos nuevos (no hay cuenta que
  // tomar). Con un correo que ya tiene tarjetas, mostrarlo dejaría entrar a cualquiera como ese cliente.
  if (publicPreviewBlocked()) {
    const existing = await repo.listCustomerCards(pending.email).catch(() => []);
    if (existing.length > 0) return { ...base, step: 'form', error: PREVIEW_EXISTING };
  }
  let code: string;
  try {
    const r = await repo.requestEmailOtp(pending.email);
    if (!r.ok) return { ...base, step: 'form', error: r.error };
    code = r.code;
  } catch (e) {
    console.error('requestEmailOtp:', e instanceof Error ? e.message : e);
    return { ...base, step: 'form', error: GENERIC };
  }
  const sent = await sendOtpEmail({ to: pending.email, code, businessName });
  if (!sent.sent && !sent.preview) return { ...base, step: 'form', error: SEND_FAILED };
  await savePendingSignup(pending);
  return { ...base, notice, previewCode: sent.sent ? undefined : code };
}

/* ---------- Alta o ingreso: pedir código ---------- */

/** Campos: mode ('alta' | 'ingreso'), slug (opcional en /mis-tarjetas), email, stampCode (opcional) y, en alta, name, day, month (0..11), year, consent. */
export async function requestCodeAction(prev: FlowState, fd: FormData): Promise<FlowState> {
  const mode = str(fd, 'mode') === 'ingreso' ? 'ingreso' : 'alta';
  const state: FlowState = { step: 'form', mode, nonce: Date.now() };
  const slug = str(fd, 'slug');

  let business: Business | null = null;
  if (slug || mode === 'alta') {
    business = await businessFor(slug);
    if (!business) return { ...state, error: 'No encontramos este negocio.' };
    const st = businessStatus(business);
    if (mode === 'alta' && st !== 'active') return { ...state, error: NOT_OPEN };
    if (mode === 'ingreso' && st === 'setup') return { ...state, error: NOT_OPEN };
  }

  const fieldErrors: Partial<Record<FlowField, string>> = {};
  const email = normalizeEmail(str(fd, 'email'));
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';

  let profile: Profile | undefined;
  if (mode === 'alta') {
    const p = readProfile(fd);
    if (!p.ok) Object.assign(fieldErrors, p.fieldErrors);
    else profile = p.value;
  }
  if (Object.keys(fieldErrors).length > 0) return { ...state, fieldErrors, error: 'Revisa los datos marcados.' };

  const stampCode = cleanCode(str(fd, 'stampCode')) ?? undefined;
  const pending: PendingSignup = {
    mode, email, slug: business?.slug, stampCode,
    ...(profile ? { name: profile.name, birthday: profile.birthday, birthdayYear: profile.year } : {})
  };
  return issueAndSend(pending, business?.name);
}

/** Reenvía el código al mismo correo (sale de la cookie firmada, no del formulario). */
export async function resendCodeAction(prev: FlowState): Promise<FlowState> {
  const pending = await readPendingSignup();
  if (!pending) return { step: 'form', mode: prev.mode, error: EXPIRED, nonce: Date.now() };
  const business = pending.slug ? await getRepo().getBusinessBySlug(pending.slug) : null;
  const next = await issueAndSend(pending, business?.name, 'Te enviamos un código nuevo.');
  return next.step === 'form' ? { ...next, step: 'code', email: pending.email } : next;
}

/** "Cambiar correo": olvida los datos pendientes y vuelve al formulario. */
export async function cancelPendingAction(prev: FlowState): Promise<FlowState> {
  await clearPendingSignup();
  return { step: 'form', mode: prev.mode, nonce: Date.now() };
}

/** Un solo punto de entrada para el formulario de alta o ingreso: el campo `intent` elige el paso. */
export async function flowAction(prev: FlowState, fd: FormData): Promise<FlowState> {
  switch (str(fd, 'intent')) {
    case 'verify': return verifyCodeAction(prev, fd);
    case 'resend': return resendCodeAction(prev);
    case 'cancel': return cancelPendingAction(prev);
    default: return requestCodeAction(prev, fd);
  }
}

/* ---------- Verificar el código del correo ---------- */

export async function verifyCodeAction(prev: FlowState, fd: FormData): Promise<FlowState> {
  const pending = await readPendingSignup();
  if (!pending) return { step: 'form', mode: prev.mode, error: EXPIRED, nonce: Date.now() };
  const state: FlowState = { step: 'code', mode: pending.mode, email: pending.email, previewCode: prev.previewCode, nonce: Date.now() };

  const ip = await clientIp();
  const limiter = otpVerifyLimiter();
  const locked = limiter.lockedFor(ip);
  if (locked > 0) return { ...state, error: `Demasiados intentos. Espera ${waitText(locked)} y vuelve a intentarlo.` };
  const code = cleanCode(str(fd, 'code'));
  if (!code) return { ...state, fieldErrors: { code: 'Escribe los 6 números del código.' } };

  const repo = getRepo();
  let ok = false;
  try { ok = await repo.verifyEmailOtp(pending.email, code); } catch (e) {
    console.error('verifyEmailOtp:', e instanceof Error ? e.message : e);
    return { ...state, error: GENERIC };
  }
  if (!ok) {
    limiter.fail(ip);
    return { ...state, fieldErrors: { code: BAD_CODE } };
  }

  await createCustomerSession(pending.email);
  await clearPendingSignup();

  if (!pending.slug) redirect('/mis-tarjetas');
  const business = await repo.getBusinessBySlug(pending.slug);
  if (!business) redirect('/mis-tarjetas');

  let isNew = false;
  let existing = await repo.findCustomerByEmail(business.id, pending.email);
  if (!existing && pending.mode === 'alta' && pending.name && pending.birthday && businessStatus(business) === 'active') {
    try {
      existing = await repo.registerVerifiedCustomer(business.id, { name: pending.name, email: pending.email, birthday: pending.birthday, birthdayYear: pending.birthdayYear });
      isNew = true;
    } catch (e) {
      // La sesión ya está creada: la página le ofrecerá unirse con sus datos.
      console.error('registerVerifiedCustomer:', e instanceof Error ? e.message : e);
    }
  }
  if (pending.stampCode && businessStatus(business) === 'active') redirect(stampPath(business.slug, pending.stampCode), RedirectType.replace);
  redirect(customerPath(business.slug) + (existing ? (isNew ? '?nueva=1' : '?hola=1') : ''));
}

/* ---------- Unirse con la sesión ya abierta (otra tarjeta con el mismo correo) ---------- */

export async function joinAction(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  const session = await readCustomerSession();
  const business = await businessFor(str(fd, 'slug'));
  if (!business) return { error: 'No encontramos este negocio.' };
  if (!session) redirect(customerPath(business.slug));
  if (businessStatus(business) !== 'active') return { error: NOT_OPEN };
  const p = readProfile(fd);
  if (!p.ok) return { fieldErrors: p.fieldErrors, error: 'Revisa los datos marcados.' };
  try {
    await getRepo().registerVerifiedCustomer(business.id, { name: p.value.name, email: session.email, birthday: p.value.birthday, birthdayYear: p.value.year });
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : GENERIC };
  }
  const stampCode = cleanCode(str(fd, 'stampCode'));
  if (stampCode) redirect(stampPath(business.slug, stampCode), RedirectType.replace);
  redirect(customerPath(business.slug) + '?nueva=1');
}

/* ---------- Reclamar un sello ---------- */

export async function claimAction(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  const business = await businessFor(str(fd, 'slug'));
  if (!business) return { error: 'No encontramos este negocio.' };
  const session = await readCustomerSession();
  if (!session) redirect(customerPath(business.slug));
  if (businessStatus(business) !== 'active') return { error: 'Este negocio pausó su tarjeta por ahora. No se pueden sumar sellos.' };

  const ip = await clientIp();
  const limiter = claimLimiter();
  const locked = limiter.lockedFor(ip);
  if (locked > 0) return { error: `Demasiados intentos. Espera ${waitText(locked)} o pide ayuda en caja.` };
  const code = cleanCode(str(fd, 'code'));
  if (!code) return { fieldErrors: { code: 'Escribe los 6 números del código que te dieron en caja.' } };

  const repo = getRepo();
  const customer = await repo.findCustomerByEmail(business.id, session.email);
  if (!customer) redirect(customerPath(business.slug));
  let result;
  try { result = await repo.claimStampCode(business.id, code, customer.id); } catch (e) {
    console.error('claimStampCode:', e instanceof Error ? e.message : e);
    return { error: GENERIC };
  }
  if (!result.ok) {
    limiter.fail(ip);
    return { error: result.error };
  }
  await syncWalletPass(business.id, customer.id);
  redirect(customerPath(business.slug) + '?sellado=1', RedirectType.replace);
}

/* ---------- Salir ---------- */

export async function signOutAction(fd: FormData): Promise<void> {
  await clearCustomerSession();
  await clearPendingSignup();
  const business = await businessFor(str(fd, 'slug'));
  const code = str(fd, 'c');
  // Desde la página del sello, quien sale sigue con el mismo código para registrarse o entrar con su correo.
  if (business && /^\d{6}$/.test(code)) redirect(stampPath(business.slug, code));
  redirect(business ? customerPath(business.slug) : '/mis-tarjetas');
}
