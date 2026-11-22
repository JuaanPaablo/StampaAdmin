import type { Plan } from './contracts';

/**
 * Planes de Stampa (precios con IVA incluido). Fuente única de lo que incluye cada plan: la usan el panel, el repo y el
 * administrador. Segura para el navegador (sin dependencias de Node).
 */

export const PLANS: Plan[] = ['basico', 'standard', 'pro'];
export const DEFAULT_PLAN: Plan = 'standard';

export interface PlanFeatures {
  label: string;
  /** Precio mensual en centavos de dólar, IVA incluido. */
  priceCents: number;
  maxLocations: number;
  /** Personas del equipo además del dueño (activas). */
  maxStaff: number;
  /** Premios intermedios por tarjeta. */
  maxMilestones: number;
  /** Periodo máximo de las estadísticas del resumen. */
  statsDays: 30 | 90;
  /** Alertas antifraude (el registro de actividad está en todos los planes). */
  alerts: boolean;
  /** Reporte de sellos por cajero (Control). */
  staffReport: boolean;
  exportCsv: boolean;
  posterDesign: boolean;
  /** Textos de marketing con IA por mes. */
  aiTexts: number;
  /** Posts basados en los datos del negocio. */
  dataPosts: boolean;
  /** Calendario semanal de publicaciones. */
  aiCalendar: boolean;
  /** Respuestas a reseñas de Google. */
  aiReviews: boolean;
  proximity: boolean;
  pushCampaigns: number;
  giftCards: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  basico: {
    label: 'Básico', priceCents: 2999, maxLocations: 1, maxStaff: 3, maxMilestones: 1, statsDays: 30, alerts: false, staffReport: false, exportCsv: false,
    posterDesign: false, aiTexts: 10, dataPosts: false, aiCalendar: false, aiReviews: false, proximity: false, pushCampaigns: 0, giftCards: false
  },
  standard: {
    label: 'Standard', priceCents: 5499, maxLocations: 3, maxStaff: 10, maxMilestones: 3, statsDays: 90, alerts: true, staffReport: false, exportCsv: true,
    posterDesign: true, aiTexts: 40, dataPosts: true, aiCalendar: false, aiReviews: false, proximity: true, pushCampaigns: 2, giftCards: true
  },
  pro: {
    label: 'Pro', priceCents: 7999, maxLocations: 10, maxStaff: Number.POSITIVE_INFINITY, maxMilestones: 3, statsDays: 90, alerts: true, staffReport: true, exportCsv: true,
    posterDesign: true, aiTexts: 120, dataPosts: true, aiCalendar: true, aiReviews: true, proximity: true, pushCampaigns: 8, giftCards: true
  }
};

export const PLAN_LABEL: Record<Plan, string> = { basico: 'Básico', standard: 'Standard', pro: 'Pro' };

export function planOf(plan: string | undefined | null): Plan {
  if (plan === 'basico' || plan === 'standard' || plan === 'pro') return plan;
  if (plan === 'gratis') return 'basico';
  if (plan === 'negocio') return 'standard';
  return 'basico';
}

export function features(plan: Plan | string | undefined | null): PlanFeatures {
  return PLAN_FEATURES[planOf(plan)];
}

/** "$54,99" */
export function planPrice(plan: Plan): string {
  return '$' + (PLAN_FEATURES[plan].priceCents / 100).toFixed(2).replace('.', ',');
}

/** El plan más barato que incluye una función (para los avisos "Disponible desde Standard"). */
export function cheapestWith(test: (f: PlanFeatures) => boolean): Plan | null {
  return PLANS.find((p) => test(PLAN_FEATURES[p])) ?? null;
}

/** Lo que incluye un plan, en frases cortas para Ajustes. */
export function planIncludes(plan: Plan): string[] {
  const f = features(plan);
  const n = (x: number, one: string, many: string) => (Number.isFinite(x) ? `${x} ${x === 1 ? one : many}` : `${many.charAt(0).toUpperCase()}${many.slice(1)} sin límite`);
  return [
    n(f.maxLocations, 'sucursal', 'sucursales'),
    Number.isFinite(f.maxStaff) ? `Hasta ${f.maxStaff} personas en tu equipo` : 'Equipo sin límite',
    f.maxMilestones === 1 ? '1 premio antes del final' : `Hasta ${f.maxMilestones} premios antes del final`,
    `Estadísticas de ${f.statsDays} días`,
    f.alerts ? 'Alertas antifraude' : 'Registro de actividad',
    f.staffReport ? 'Reporte por persona del equipo' : '',
    f.exportCsv ? 'Exportar a Excel (CSV)' : '',
    f.posterDesign ? 'Póster con tu diseño' : '',
    `${f.aiTexts} textos con IA al mes`,
    f.dataPosts ? 'Posts con tus datos' : '',
    f.aiCalendar ? 'Calendario semanal y respuestas a reseñas' : ''
  ].filter(Boolean);
}
