import { redirect } from 'next/navigation';
import type { Business, Program, Staff } from './contracts';
import { businessStatus } from './mvp-rules';
import { getRepo, type Repo } from './repo';
import { readSession } from './session';
import { getTemplate, type BusinessTemplate } from './templates';

export interface PanelContext {
  repo: Repo;
  business: Business;
  program: Program;
  template: BusinessTemplate;
  /** Persona que opera el panel (la de la sesión). */
  staff: Staff;
}

/**
 * Contexto de la sesión actual, o null si no hay sesión válida (cookie firmada y vigente) o la persona ya no existe,
 * fue desactivada o no pertenece al negocio de la sesión. Úsala (y no readSession) para decidir si alguien "ya entró".
 * NO mira el estado del negocio: para eso están getContext() y getSetupContext().
 */
export async function getSessionContext(): Promise<PanelContext | null> {
  const session = await readSession();
  if (!session) return null;
  const repo = getRepo();
  const business = await repo.getBusiness(session.businessId);
  if (!business) return null;
  const [program, staffList] = await Promise.all([repo.getProgram(business.id), repo.listStaff(business.id)]);
  const staff = staffList.find((s) => s.id === session.staffId && s.active);
  if (!staff) return null;
  return { repo, business, program, template: getTemplate(business.type), staff };
}

/** Pantalla que corresponde al estado del negocio, o null si puede usar el panel. */
export function statusRedirect(ctx: Pick<PanelContext, 'business' | 'staff'>, opts?: { allowSetup?: boolean }): '/bienvenida' | '/suspendido' | null {
  const st = businessStatus(ctx.business);
  if (st === 'suspended') return '/suspendido';
  if (st === 'setup' && !(opts?.allowSetup && ctx.staff.role === 'owner')) return '/bienvenida';
  return null;
}

/**
 * Contexto de cada página y acción del panel (solo servidor).
 * - Sin sesión válida redirige a /ingresar (también en desarrollo).
 * - Negocio en configuración ('setup') → /bienvenida. Negocio suspendido → /suspendido.
 * `allowSetup` deja pasar al DUEÑO de un negocio en configuración: lo usan las acciones que el asistente comparte con el
 * panel (guardar la tarjeta, subir imágenes, sucursales). Las páginas de /panel nunca lo usan.
 */
export async function getContext(opts?: { allowSetup?: boolean }): Promise<PanelContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/ingresar');
  const to = statusRedirect(ctx, opts);
  if (to) redirect(to);
  return ctx;
}

/**
 * Contexto del asistente de bienvenida: solo el dueño de un negocio que sigue en 'setup'. null en cualquier otro caso
 * (sin sesión, otro rol o negocio ya activo o suspendido). Las acciones del asistente responden con un error si es null.
 */
export async function getSetupContext(): Promise<PanelContext | null> {
  const ctx = await getSessionContext();
  if (!ctx || ctx.staff.role !== 'owner' || businessStatus(ctx.business) !== 'setup') return null;
  return ctx;
}
