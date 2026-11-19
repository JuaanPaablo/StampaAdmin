import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from './contracts';
import type { PanelContext } from './context';
import { getRepo } from './repo';
import { isDemoMode } from './demo';

/**
 * Acceso y sesión del panel (solo servidor).
 *
 * Cómo lo usan los demás módulos:
 *   const ctx = await getContext();
 *   requireRole(ctx, ['owner', 'manager']);   // redirige a /panel/caja si el rol no alcanza
 *
 * Llama a requireRole al inicio de cualquier página o acción que deba ser restringida. El menú lateral ya oculta
 * lo que el rol no puede ver (NAV), pero un enlace directo sigue funcionando: la protección real es requireRole.
 * Para acciones de servidor que devuelven { ok, error } usa `hasRole(ctx, roles)` y responde con un error en lugar
 * de redirigir.
 *
 * Limitación conocida: la sesión es el par de cookies 'stampa_biz' y 'stampa_staff' (httpOnly, sin firma). Es
 * suficiente para el modo demo; en producción debe reemplazarse por la sesión de Supabase Auth.
 */

export const BIZ_COOKIE = 'stampa_biz';
export const STAFF_COOKIE = 'stampa_staff';
const SESSION_SECONDS = 60 * 60 * 12;

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_SECONDS };
}

export function hasRole(ctx: Pick<PanelContext, 'staff'>, roles: Role[]): boolean {
  return roles.includes(ctx.staff.role);
}

/** Redirige a /panel/caja (o /panel/caja ya es la pantalla de todos los roles) si la persona no tiene el rol. */
export function requireRole(ctx: Pick<PanelContext, 'staff'>, roles: Role[]): void {
  if (!hasRole(ctx, roles)) redirect('/panel/caja');
}

export async function setSession(businessId: string, staffId: string): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(BIZ_COOKIE, businessId, cookieOptions());
  jar.set(STAFF_COOKIE, staffId, cookieOptions());
}

export async function clearSession(): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.delete(BIZ_COOKIE);
  jar.delete(STAFF_COOKIE);
}

/* ---------- Límite de intentos de PIN (por proceso) ---------- */
const MAX_FAILS = 5;
const LOCK_MS = 60_000;
const fails = new Map<string, { n: number; until: number }>();

export type SignInResult =
  | { ok: true; role: Role; redirectTo: string }
  | { ok: false; error: string; field?: 'business' | 'staff' | 'pin' };

/** Verifica el PIN y fija las cookies de sesión. No lanza errores en casos esperados. */
export async function signIn(businessId: string, staffId: string, pin: string): Promise<SignInResult> {
  if (!businessId) return { ok: false, error: 'Elige tu negocio.', field: 'business' };
  if (!staffId) return { ok: false, error: 'Elige quién eres.', field: 'staff' };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'El PIN tiene 4 dígitos.', field: 'pin' };

  const key = businessId + ':' + staffId;
  const state = fails.get(key);
  if (state && state.until > Date.now()) {
    const secs = Math.ceil((state.until - Date.now()) / 1000);
    return { ok: false, error: `Demasiados intentos. Espera ${secs} segundos e inténtalo de nuevo.`, field: 'pin' };
  }

  const repo = getRepo();
  const staff = (await repo.listStaff(businessId)).find((s) => s.id === staffId);
  if (!staff || !staff.active || !staff.hasPin) return { ok: false, error: 'Esa persona no puede ingresar. Pide al dueño que revise el equipo.', field: 'staff' };

  const valid = await repo.verifyStaffPin(businessId, staffId, pin);
  if (!valid) {
    const n = (state && state.until === 0 ? state.n : 0) + 1;
    fails.set(key, n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 });
    return { ok: false, error: 'PIN incorrecto. Revisa e inténtalo otra vez.', field: 'pin' };
  }
  fails.delete(key);
  await setSession(businessId, staffId);
  return { ok: true, role: staff.role, redirectTo: staff.role === 'cashier' ? '/panel/caja' : '/panel' };
}

/** Cierra la sesión y vuelve a la pantalla de acceso. */
export async function signOut(): Promise<never> {
  await clearSession();
  redirect('/ingresar');
}

/* ---------- Ayudas del modo demo ---------- */
const g = globalThis as unknown as { __stampaRegistered?: Set<string> };
/** Marca un negocio creado por el asistente de registro: nunca se muestran sus PIN. */
export function markRegistered(businessId: string): void {
  (g.__stampaRegistered ??= new Set()).add(businessId);
}

const DEMO_PIN_CANDIDATES = ['1234', '0000', '1111', '2222', '3333', '4321', '1212', '2580', '1357', '2468', '4567', '1010', '5555', '9999'];

/**
 * PIN de demostración de un negocio de ejemplo. Prueba un conjunto corto de PIN conocidos contra el repositorio
 * (el PIN nunca sale del repo), y omite los negocios creados desde /registro. Solo para la nota "Credenciales de prueba".
 */
export async function demoCredentials(businessId: string): Promise<{ staffId: string; pin: string }[]> {
  if (!isDemoMode() || g.__stampaRegistered?.has(businessId)) return [];
  const repo = getRepo();
  const staff = (await repo.listStaff(businessId)).filter((s) => s.active && s.hasPin);
  const out: { staffId: string; pin: string }[] = [];
  for (const s of staff) {
    for (const pin of DEMO_PIN_CANDIDATES) {
      if (await repo.verifyStaffPin(businessId, s.id, pin)) { out.push({ staffId: s.id, pin }); break; }
    }
  }
  return out;
}
