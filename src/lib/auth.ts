import { redirect } from 'next/navigation';
import type { Role } from './contracts';
import type { PanelContext } from './context';

/**
 * Acceso del panel.
 *
 * - Autenticación: correo + contraseña (signIn / signOut, server actions en auth-actions.ts, reexportadas aquí).
 *   La sesión es la cookie firmada `stampa_session` (session.ts). No hay registro público: las cuentas las crea el equipo de
 *   Stampa con `npm run account:create`.
 * - Autorización, como lo usan los demás módulos:
 *     const ctx = await getContext();
 *     requireRole(ctx, ['owner', 'manager']);   // redirige a /panel/caja si el rol no alcanza
 *   Llama a requireRole al inicio de cualquier página o acción restringida; ocultar el menú no es la protección.
 *   Para server actions que devuelven { ok, error } usa `hasRole(ctx, roles)` y responde con un error en lugar de redirigir.
 *
 * Este módulo no importa nada que dependa del servidor (solo redirect y las acciones), así que un componente cliente
 * puede importar `signIn` y `LoginState` desde aquí.
 */

export { signIn, signOut } from './auth-actions';
export type { LoginState } from './auth-actions';

export function hasRole(ctx: Pick<PanelContext, 'staff'>, roles: Role[]): boolean {
  return roles.includes(ctx.staff.role);
}

/** Redirige a /panel/caja si la persona no tiene el rol (esa pantalla es de todos los roles). */
export function requireRole(ctx: Pick<PanelContext, 'staff'>, roles: Role[]): void {
  if (!hasRole(ctx, roles)) redirect('/panel/caja');
}
