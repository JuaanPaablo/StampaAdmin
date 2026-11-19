import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDemoMode } from './demo';
import { DEMO_BUSINESS_ID, type Business, type Program, type Staff } from './contracts';
import { getRepo, type Repo } from './repo';
import { getTemplate, type BusinessTemplate } from './templates';

export interface PanelContext {
  repo: Repo;
  business: Business;
  program: Program;
  template: BusinessTemplate;
  /** Persona que opera el panel. En modo demo es el dueño del negocio. */
  staff: Staff;
}

/**
 * Contexto de cada página del panel (solo en servidor). Lee las cookies 'stampa_biz' y 'stampa_staff'.
 * Sin cookies usa el negocio demo. El agente B puede endurecer esta función (login real) SIN cambiar su firma.
 */
export async function getContext(): Promise<PanelContext> {
  const repo = getRepo();
  const jar = await Promise.resolve(cookies());
  const demo = isDemoMode();
  const bizCookie = jar.get('stampa_biz')?.value;
  const staffId = jar.get('stampa_staff')?.value;
  // Fuera del modo demo no hay sesión implícita: sin cookies se pide ingresar.
  if (!bizCookie && !demo) redirect('/ingresar');
  const business = (await repo.getBusiness(bizCookie ?? DEMO_BUSINESS_ID)) ?? (demo ? (await repo.listBusinesses())[0] : null);
  if (!business) redirect('/ingresar');
  const [program, staffList] = await Promise.all([repo.getProgram(business.id), repo.listStaff(business.id)]);
  // Una persona que no pertenece a este negocio (o fue desactivada) invalida la sesión; nunca se degrada a dueño.
  const found = staffList.find((s) => s.id === staffId && s.active);
  if (!found && (staffId || !demo)) redirect('/ingresar');
  const staff = found ?? staffList.find((s) => s.role === 'owner') ?? staffList[0];
  return { repo, business, program, template: getTemplate(business.type), staff };
}
