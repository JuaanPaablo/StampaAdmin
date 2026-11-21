import { cookies } from 'next/headers';
import { normalizeEmail, validateEmail } from './credentials';
import { CUSTOMER_SESSION_DAYS } from './mvp-rules';
import { issued, signData, verifyData, type SignedBase } from './signed';

/**
 * Sesión del cliente en su teléfono (cookie `stampa_cliente`, 365 días). Guarda solo el correo VERIFICADO con el código
 * de 6 dígitos: con el mismo correo el cliente ve sus tarjetas de todos los negocios.
 *
 * Además, mientras el cliente espera el código, sus datos del formulario viajan en una cookie firmada de corta vida
 * (`stampa_cliente_pendiente`, 15 min). Así el servidor nunca confía en campos ocultos del formulario.
 */

export const CUSTOMER_COOKIE = 'stampa_cliente';
export const CUSTOMER_AUD = 'cliente';
export const CUSTOMER_SESSION_SECONDS = CUSTOMER_SESSION_DAYS * 86_400;

export const PENDING_COOKIE = 'stampa_cliente_pendiente';
export const PENDING_AUD = 'cliente-pendiente';
export const PENDING_SECONDS = 15 * 60;

export interface CustomerSession { email: string }
interface CustomerPayload extends SignedBase { email: string }

/** alta = cliente nuevo con sus datos · ingreso = "Ya tengo tarjeta" (solo correo). */
export type PendingMode = 'alta' | 'ingreso';

export interface PendingSignup {
  mode: PendingMode;
  email: string;
  /** Negocio donde empezó (ausente si vino de /mis-tarjetas). */
  slug?: string;
  name?: string;
  birthday?: { d: number; m: number };
  birthdayYear?: number;
  /** Código de sello por reclamar al terminar (vino del QR de caja). */
  stampCode?: string;
}
interface PendingPayload extends SignedBase { p: PendingSignup }

/* ---------- Lógica pura (probada en customer-session.test.ts) ---------- */

export function signCustomerToken(email: string, nowMs: number = Date.now(), secret?: string): string {
  const e = normalizeEmail(email);
  if (validateEmail(e)) throw new Error('Correo no válido para la sesión del cliente.');
  return signData<CustomerPayload>({ aud: CUSTOMER_AUD, ...issued(CUSTOMER_SESSION_SECONDS, nowMs), email: e }, secret);
}

export function verifyCustomerToken(token: string | undefined | null, nowMs: number = Date.now(), secret?: string): CustomerSession | null {
  const p = verifyData<CustomerPayload>(token, CUSTOMER_AUD, nowMs, secret);
  if (!p || typeof p.email !== 'string') return null;
  const email = normalizeEmail(p.email);
  return validateEmail(email) ? null : { email };
}

export function signPendingToken(p: PendingSignup, nowMs: number = Date.now(), secret?: string): string {
  return signData<PendingPayload>({ aud: PENDING_AUD, ...issued(PENDING_SECONDS, nowMs), p: { ...p, email: normalizeEmail(p.email) } }, secret);
}

export function verifyPendingToken(token: string | undefined | null, nowMs: number = Date.now(), secret?: string): PendingSignup | null {
  const v = verifyData<PendingPayload>(token, PENDING_AUD, nowMs, secret);
  const p = v?.p;
  if (!p || (p.mode !== 'alta' && p.mode !== 'ingreso') || typeof p.email !== 'string' || validateEmail(p.email)) return null;
  return p;
}

/* ---------- Cookies (solo servidor) ---------- */

const base = () => ({ httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production' });

export async function readCustomerSession(): Promise<CustomerSession | null> {
  const jar = await Promise.resolve(cookies());
  return verifyCustomerToken(jar.get(CUSTOMER_COOKIE)?.value);
}

export async function createCustomerSession(email: string): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(CUSTOMER_COOKIE, signCustomerToken(email), { ...base(), maxAge: CUSTOMER_SESSION_SECONDS });
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(CUSTOMER_COOKIE, '', { ...base(), maxAge: 0 });
}

export async function readPendingSignup(): Promise<PendingSignup | null> {
  const jar = await Promise.resolve(cookies());
  return verifyPendingToken(jar.get(PENDING_COOKIE)?.value);
}

export async function savePendingSignup(p: PendingSignup): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(PENDING_COOKIE, signPendingToken(p), { ...base(), maxAge: PENDING_SECONDS });
}

export async function clearPendingSignup(): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(PENDING_COOKIE, '', { ...base(), maxAge: 0 });
}
