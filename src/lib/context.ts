import { redirect } from 'next/navigation';
import type { Business, Program, Staff } from './contracts';
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

/** Contexto de cada página del panel (solo servidor). Sin sesión válida redirige a /ingresar, también en desarrollo. */
export async function getContext(): Promise<PanelContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/ingresar');
  return ctx;
}
