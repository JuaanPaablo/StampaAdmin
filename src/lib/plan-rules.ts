import type { Plan } from './contracts';
import { features } from './plans';

/** Reglas del plan que también usa el navegador (sin dependencias de Node). */

/** Sucursales que permite cada plan. */
export function maxLocations(plan: Plan): number {
  return features(plan).maxLocations;
}

/** Personas del equipo (además del dueño) que permite cada plan. */
export function maxStaff(plan: Plan): number {
  return features(plan).maxStaff;
}

/** "Tu plan Básico permite hasta 3 personas en tu equipo." */
export function staffLimitText(plan: Plan, label: string): string {
  const n = maxStaff(plan);
  return Number.isFinite(n) ? `Tu plan ${label} permite hasta ${n} ${n === 1 ? 'persona' : 'personas'} en tu equipo, además de ti.` : `Tu plan ${label} no tiene límite de personas en tu equipo.`;
}

/** "Tu plan Negocio permite hasta 3 sucursales." */
export function locationLimitText(plan: Plan, label: string): string {
  const n = maxLocations(plan);
  return `Tu plan ${label} permite ${n === 1 ? '1 sucursal' : `hasta ${n} sucursales`}.`;
}

/** Suma `months` meses calendario conservando el día (31 ene + 1 mes = 28/29 feb). */
export function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.getTime();
}

/**
 * Vencimiento efectivo: con renovación automática, un plan vencido avanza de mes en mes hasta quedar en el futuro.
 * Así nadie tiene que actualizar la fecha a mano cada mes.
 */
export function effectiveExpiry(planExpiresAt: string | undefined, autoRenew: boolean | undefined, nowMs: number = Date.now()): string | undefined {
  if (!planExpiresAt || !autoRenew) return planExpiresAt;
  let t = Date.parse(planExpiresAt);
  if (!Number.isFinite(t)) return planExpiresAt;
  for (let i = 0; t <= nowMs && i < 1200; i++) t = addMonths(Date.parse(planExpiresAt), i + 1);
  return new Date(t).toISOString();
}

/** Fecha de hoy en Ecuador como "AAAA-MM-DD" (para el `min` de los campos de fecha). */
export function todayEc(nowMs: number = Date.now()): string {
  return new Date(nowMs - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** Error al superar el equipo del plan. */
export function staffLimitError(plan: Plan): string {
  const f = features(plan);
  return `Tu plan ${f.label} permite hasta ${f.maxStaff} ${f.maxStaff === 1 ? 'persona' : 'personas'} en tu equipo además de ti. Desactiva a alguien o escríbenos para cambiar de plan.`;
}
