import type {
  AdminActionKind, AdminBusinessRow, AdminInsights, AdminPayment, AdminTask, AiCostRow, AiUsage, Business,
  BusinessActivity, BusinessHealth, BusinessStatus, MoneyLine, PaymentMethod, Plan, PlanBreakdown, SeriesPoint, Severity
} from '../contracts';
import { PLAN_FEATURES, PLAN_LABEL, PLANS } from '../plans';

/**
 * REGLAS PURAS DEL PANEL DE ADMINISTRADOR (sin base de datos, sin Next, seguras para el navegador).
 * Las usan memory.ts y supabase.ts para armar repo.getAdminInsights() y repo.getAdminBusinessDetail(); la interfaz
 * puede usar las mismas funciones (etiquetas, semáforo, costo de IA, validar un pago antes de enviarlo).
 *
 * Calendario: Ecuador continental es UTC-5 todo el año (sin horario de verano), así que los días, semanas (lunes a
 * domingo) y meses se calculan con un desfase fijo. Debe coincidir con `at time zone 'America/Guayaquil'` en SQL.
 */

export const EC_OFFSET_MINUTES = -300;
const EC_OFFSET_MS = EC_OFFSET_MINUTES * 60_000;
const DAY = 86_400_000;

/* ---------- Umbrales (documentados en README) ---------- */

/** Semáforo: verde si el último sello fue hace menos de 7 días; amarillo hasta 14; rojo después. */
export const HEALTH_GREEN_DAYS = 7;
export const HEALTH_YELLOW_DAYS = 14;
/** "Hoy te toca": activo sin sellos hace más de 7 días. */
export const INACTIVE_DAYS = 7;
/** "Hoy te toca": más de 3 días en el asistente después de crear la contraseña. */
export const SETUP_STUCK_DAYS = 3;
/** "Hoy te toca": el plan vence en 7 días o menos. */
export const PAYMENT_DUE_DAYS = 7;
/** Renovaciones que se muestran: próximos 30 días. */
export const RENEWAL_WINDOW_DAYS = 30;

/** Mismo texto que PLACEHOLDER_BUSINESS_NAME (mvp-rules.ts); se repite aquí para no importar node:crypto en el navegador. */
const PLACEHOLDER = 'Negocio nuevo';
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* ===================================== Fechas de Ecuador ===================================== */

const toMs = (v: string | number): number => (typeof v === 'number' ? v : Date.parse(v));

/** Número de día calendario en Ecuador (días desde 1970-01-01). */
export function ecDayNumber(at: string | number): number {
  return Math.floor((toMs(at) + EC_OFFSET_MS) / DAY);
}

/** Días calendario (Ecuador) de `from` a `to`: positivo si `to` es posterior. */
export function ecCalendarDays(from: string | number, to: string | number): number {
  return ecDayNumber(to) - ecDayNumber(from);
}

const keyOfDayNumber = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' en Ecuador. */
export function ecDayKey(at: string | number): string {
  return keyOfDayNumber(ecDayNumber(at));
}

/** 'YYYY-MM-DD' del lunes de la semana (Ecuador) que contiene `at`. Igual que date_trunc('week', ...) en Postgres. */
export function ecWeekKey(at: string | number): string {
  const d = ecDayNumber(at);
  const weekday = (((d + 4) % 7) + 7) % 7;          // 0 = domingo (el 1970-01-01 fue jueves)
  return keyOfDayNumber(d - ((weekday + 6) % 7));
}

/** 'YYYY-MM' en Ecuador. */
export function ecMonthKey(at: string | number): string {
  return ecDayKey(at).slice(0, 7);
}

/** Inicio del mes actual en Ecuador (ISO), p. ej. '2026-11-01T05:00:00.000Z'. */
export function ecMonthStartIso(nowMs: number = Date.now()): string {
  const [y, m] = ecMonthKey(nowMs).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - EC_OFFSET_MS).toISOString();
}

/** Fin del día 'YYYY-MM-DD' en Ecuador (23:59:59), como hace el campo de fecha del admin (parseDateInput). */
export function ecEndOfDayIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59) - EC_OFFSET_MS).toISOString();
}

/** true si es 'YYYY-MM-DD' y la fecha existe. */
export function isDayKey(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Suma meses de calendario a un día 'YYYY-MM-DD' (31 ene + 1 mes = 28/29 feb). */
export function addMonthsToDay(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

/** "25 nov 2026" (Ecuador). */
export function ecDateLabel(at: string | number): string {
  const [y, m, d] = ecDayKey(at).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const dayLabel = (key: string) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

/* ===================================== Series ===================================== */

export type SeriesUnit = 'day' | 'week' | 'month';

/** Claves (más antigua primero) de los últimos `n` días / semanas / meses, incluido el actual, con su etiqueta. */
export function seriesKeys(unit: SeriesUnit, n: number, nowMs: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (unit === 'month') {
    const [y, m] = ecMonthKey(nowMs).split('-').map(Number);
    for (let i = n - 1; i >= 0; i--) {
      const t = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = t.toISOString().slice(0, 7);
      out.push({ key, label: monthLabel(key) });
    }
    return out;
  }
  const today = ecDayNumber(nowMs);
  const start = unit === 'day' ? today : Math.floor(Date.parse(ecWeekKey(nowMs)) / DAY);
  const step = unit === 'day' ? 1 : 7;
  for (let i = n - 1; i >= 0; i--) {
    const key = keyOfDayNumber(start - i * step);
    out.push({ key, label: dayLabel(key) });
  }
  return out;
}

/** Clave de un instante para la unidad dada. */
export function seriesKeyOf(unit: SeriesUnit, at: string | number): string {
  return unit === 'day' ? ecDayKey(at) : unit === 'week' ? ecWeekKey(at) : ecMonthKey(at);
}

/** Cuenta instantes por clave (lo que hace GROUP BY en SQL). */
export function countByKey(unit: SeriesUnit, times: Iterable<string | number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of times) { const k = seriesKeyOf(unit, t); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/** Serie rellenada con ceros a partir de conteos por clave. */
export function fillSeries(unit: SeriesUnit, n: number, nowMs: number, counts: Record<string, number>): SeriesPoint[] {
  return seriesKeys(unit, n, nowMs).map(({ key, label }) => ({ key, label, value: counts[key] ?? 0 }));
}

/** Atajo: instantes -> serie rellenada con ceros. */
export function seriesFromTimes(unit: SeriesUnit, n: number, nowMs: number, times: Iterable<string | number>): SeriesPoint[] {
  return fillSeries(unit, n, nowMs, countByKey(unit, times));
}

/* ===================================== Semáforo ===================================== */

export interface HealthInput {
  status?: BusinessStatus;
  createdAt: string;
  setupCompletedAt?: string;
  lastStampAt?: string;
}

/**
 * Semáforo de actividad. Solo aplica a negocios activos ('setup' y 'suspended' = 'none').
 * Referencia = último sello; si nunca selló, desde que terminó el asistente (o desde el alta): un negocio recién activado
 * tiene 7 días de gracia antes de pasar a amarillo.
 *   menos de 7 días -> green · de 7 a 14 días -> yellow · más de 14 días -> red.
 */
export function businessHealth(b: HealthInput, nowMs: number = Date.now()): BusinessHealth {
  if ((b.status ?? 'active') !== 'active') return 'none';
  const ref = toMs(b.lastStampAt ?? b.setupCompletedAt ?? b.createdAt);
  if (!Number.isFinite(ref)) return 'red';
  const days = (nowMs - ref) / DAY;
  if (days < HEALTH_GREEN_DAYS) return 'green';
  if (days <= HEALTH_YELLOW_DAYS) return 'yellow';
  return 'red';
}

/** Días calendario desde el último sello (null = nunca). */
export function daysSince(at: string | undefined, nowMs: number = Date.now()): number | null {
  return at ? ecCalendarDays(at, nowMs) : null;
}

export const HEALTH_LABEL: Record<BusinessHealth, string> = { green: 'Activo', yellow: 'Bajando', red: 'Sin uso', none: 'No aplica' };

/* ===================================== Nombres y dinero ===================================== */

/** Nombre para mostrar (igual que displayName de components/admin/helpers). */
export function adminDisplayName(b: Pick<Business, 'name' | 'status'>): string {
  if ((b.status ?? 'active') === 'setup' && (!b.name || b.name === PLACEHOLDER)) return `${PLACEHOLDER} · configurando`;
  return b.name;
}

/** Precio mensual del plan en centavos. */
export function planPriceCents(plan: Plan): number {
  return PLAN_FEATURES[plan]?.priceCents ?? 0;
}

/** "$54,99" */
export function formatCents(cents: number): string {
  const neg = cents < 0;
  const [int, dec] = (Math.abs(cents) / 100).toFixed(2).split('.');
  return `${neg ? '-' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

const agoDays = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);

const isExpired = (b: Business, nowMs: number) => !!b.planExpiresAt && Date.parse(b.planExpiresAt) <= nowMs;

/* ===================================== Hoy te toca ===================================== */

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Tareas del día a partir de las filas del admin (necesitan stats.lastStampAt e inviteExpiresAt para todas las reglas).
 *  - payment_due (warning): no suspendido, el plan vence en 7 días calendario o menos (y todavía no venció).
 *  - plan_expired (critical): activo o configurando con el plan vencido (los suspendidos ya están atendidos).
 *  - inactive (warning; critical si lleva más de 14 días): activo, sin sellos hace más de 7 días (sin sellos nunca:
 *    cuenta desde que terminó el asistente).
 *  - invite_expired (warning): invitación pendiente y su enlace de 72 h ya venció.
 *  - setup_stuck (info): configurando, ya creó su contraseña y lleva más de 3 días desde el alta.
 */
export function buildAdminTasks(rows: AdminBusinessRow[], nowMs: number = Date.now()): AdminTask[] {
  const out: AdminTask[] = [];
  for (const row of rows) {
    const b = row.business;
    const st = b.status ?? 'active';
    const name = adminDisplayName(b);
    const base = { businessId: b.id, businessName: name, ownerEmail: row.owner?.email, ownerPhone: row.ownerPhone };
    const price = planPriceCents(b.plan);
    const push = (t: Omit<AdminTask, 'id' | 'businessId' | 'businessName' | 'ownerEmail' | 'ownerPhone'>) =>
      out.push({ id: `${t.kind}:${b.id}`, ...base, ...t });

    if (st !== 'suspended' && b.planExpiresAt) {
      const exp = Date.parse(b.planExpiresAt);
      const days = ecCalendarDays(nowMs, exp);
      if (exp <= nowMs) {
        push({
          kind: 'plan_expired', label: 'Plan vencido', severity: 'critical', at: b.planExpiresAt, days, amountCents: price,
          reason: `El plan ${PLAN_LABEL[b.plan]} venció ${agoDays(-days)}. Cobra ${formatCents(price)} o suspende el negocio.`
        });
      } else if (days <= PAYMENT_DUE_DAYS) {
        const when = days <= 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`;
        push({
          kind: 'payment_due', label: when, severity: 'warning', at: b.planExpiresAt, days, amountCents: price,
          reason: `${b.autoRenew ? 'La renovación mensual del plan' : 'El plan'} ${PLAN_LABEL[b.plan]} vence el ${ecDateLabel(b.planExpiresAt)}. Cobra ${formatCents(price)}.`
        });
      }
    }

    if (st === 'active') {
      const ref = row.stats.lastStampAt ?? b.setupCompletedAt ?? b.createdAt;
      const elapsed = (nowMs - Date.parse(ref)) / DAY;
      if (elapsed > INACTIVE_DAYS) {
        const days = ecCalendarDays(ref, nowMs);
        push({
          kind: 'inactive', label: 'Sin sellos', severity: elapsed > HEALTH_YELLOW_DAYS ? 'critical' : 'warning', at: ref, days: -days,
          reason: row.stats.lastStampAt
            ? `No registra sellos hace ${days} días. Escríbele para ver si necesita ayuda.`
            : `No ha registrado ningún sello desde que terminó la configuración, hace ${days} días.`
        });
      }
    }

    const invitePending = !!row.owner?.invitePending;
    if (invitePending && row.inviteExpiresAt && Date.parse(row.inviteExpiresAt) <= nowMs) {
      const days = ecCalendarDays(nowMs, row.inviteExpiresAt);
      push({
        kind: 'invite_expired', label: 'Invitación vencida', severity: 'warning', at: row.inviteExpiresAt, days,
        reason: `La invitación venció ${agoDays(-days)} y el dueño no entró. Reenvía el acceso.`
      });
    } else if (st === 'setup' && !invitePending && row.owner && (nowMs - Date.parse(b.createdAt)) / DAY > SETUP_STUCK_DAYS) {
      const days = ecCalendarDays(b.createdAt, nowMs);
      push({
        kind: 'setup_stuck', label: 'Sin terminar', severity: 'info', at: b.createdAt, days: -days,
        reason: `Ya creó su contraseña, pero en ${days} días no termina de configurar su negocio. Ofrécele ayuda.`
      });
    }
  }
  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.days ?? 0) - (b.days ?? 0) || a.businessName.localeCompare(b.businessName, 'es'));
}

/* ===================================== Dinero ===================================== */

const moneyLine = (row: AdminBusinessRow, nowMs: number): MoneyLine => {
  const b = row.business;
  return {
    businessId: b.id, businessName: adminDisplayName(b), status: b.status ?? 'active', plan: b.plan, amountCents: planPriceCents(b.plan),
    date: b.planExpiresAt!, days: ecCalendarDays(nowMs, b.planExpiresAt!), autoRenew: !!b.autoRenew, ownerPhone: row.ownerPhone
  };
};

/** true si el negocio suma al MRR: activo y con el plan al día (sin vencimiento o vencimiento futuro). */
export function countsForMrr(b: Business, nowMs: number = Date.now()): boolean {
  return (b.status ?? 'active') === 'active' && !isExpired(b, nowMs);
}

export interface MoneySummary {
  mrrCents: number;
  payingCount: number;
  byPlan: PlanBreakdown[];
  upcomingRenewals: { items: MoneyLine[]; totalCents: number };
  atRisk: { items: MoneyLine[]; totalCents: number };
}

/** MRR, desglose por plan, renovaciones de los próximos 30 días e ingreso en riesgo (ver AdminInsights.money). */
export function buildMoney(rows: AdminBusinessRow[], nowMs: number = Date.now()): MoneySummary {
  const byPlan = new Map<Plan, PlanBreakdown>(PLANS.map((p) => [p, { plan: p, label: PLAN_LABEL[p], count: 0, mrrCents: 0 }]));
  let mrrCents = 0;
  let payingCount = 0;
  const upcoming: MoneyLine[] = [];
  const risk: MoneyLine[] = [];
  for (const row of rows) {
    const b = row.business;
    const st = b.status ?? 'active';
    if (countsForMrr(b, nowMs)) {
      const price = planPriceCents(b.plan);
      mrrCents += price; payingCount++;
      const bp = byPlan.get(b.plan);
      if (bp) { bp.count++; bp.mrrCents += price; }
    }
    if (!b.planExpiresAt) continue;
    const exp = Date.parse(b.planExpiresAt);
    if (exp <= nowMs) {
      if (st === 'active' || st === 'suspended') risk.push(moneyLine(row, nowMs));
    } else if (st !== 'suspended' && ecCalendarDays(nowMs, exp) <= RENEWAL_WINDOW_DAYS) {
      upcoming.push(moneyLine(row, nowMs));
    }
  }
  upcoming.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  risk.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const total = (xs: MoneyLine[]) => xs.reduce((s, x) => s + x.amountCents, 0);
  return {
    mrrCents, payingCount, byPlan: [...byPlan.values()],
    upcomingRenewals: { items: upcoming, totalCents: total(upcoming) },
    atRisk: { items: risk, totalCents: total(risk) }
  };
}

/** Cobrado por mes (centavos) según el día del pago, últimos `months` meses, y lo cobrado en el mes actual. */
export function collectedByMonth(payments: Pick<AdminPayment, 'amountCents' | 'paidAt'>[], nowMs: number = Date.now(), months = 6): { series: SeriesPoint[]; thisMonthCents: number } {
  const sums: Record<string, number> = {};
  for (const p of payments) { const k = p.paidAt.slice(0, 7); sums[k] = (sums[k] ?? 0) + p.amountCents; }
  return { series: fillSeries('month', months, nowMs, sums), thisMonthCents: sums[ecMonthKey(nowMs)] ?? 0 };
}

/* ===================================== Actividad y ranking ===================================== */

const HEALTH_RANK: Record<BusinessHealth, number> = { red: 0, yellow: 1, green: 2, none: 3 };

export function businessActivity(row: AdminBusinessRow, nowMs: number = Date.now()): BusinessActivity {
  const b = row.business;
  return {
    businessId: b.id, businessName: adminDisplayName(b), slug: b.slug, status: b.status ?? 'active', plan: b.plan,
    health: businessHealth({ status: b.status, createdAt: b.createdAt, setupCompletedAt: b.setupCompletedAt, lastStampAt: row.stats.lastStampAt }, nowMs),
    lastStampAt: row.stats.lastStampAt, daysSinceLastStamp: daysSince(row.stats.lastStampAt, nowMs),
    stamps7d: row.stats.stamps7d ?? 0, stamps30d: row.stats.stamps30d, customers: row.stats.customers, ownerPhone: row.ownerPhone
  };
}

/** Semáforo de todos los negocios, con conteos. */
export function buildHealth(rows: AdminBusinessRow[], nowMs: number = Date.now()): AdminInsights['health'] {
  const businesses = rows.map((r) => businessActivity(r, nowMs));
  const counts: Record<BusinessHealth, number> = { green: 0, yellow: 0, red: 0, none: 0 };
  for (const a of businesses) counts[a.health]++;
  const idle = (a: BusinessActivity) => a.daysSinceLastStamp ?? Number.MAX_SAFE_INTEGER;
  businesses.sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || idle(b) - idle(a) || a.businessName.localeCompare(b.businessName, 'es'));
  return { counts, businesses };
}

/** Top y bottom `n` de negocios ACTIVOS por sellos en 30 días. bottom no repite a los del top. */
export function rankBusinesses(activity: BusinessActivity[], n = 5): AdminInsights['ranking'] {
  const active = activity.filter((a) => a.status === 'active');
  const desc = [...active].sort((a, b) => b.stamps30d - a.stamps30d || a.businessName.localeCompare(b.businessName, 'es'));
  const top = desc.slice(0, n);
  const inTop = new Set(top.map((a) => a.businessId));
  const bottom = [...desc].reverse().filter((a) => !inTop.has(a.businessId)).slice(0, n);
  return { top, bottom };
}

/* ===================================== Costo de IA ===================================== */

/**
 * Precios en dólares (docs/MARKETING.md). DeepSeek (textos): por millón de tokens, con caché de entrada más barata;
 * cachedTokens ya está incluido dentro de promptTokens. fal.ai Seedream (fotos): por imagen.
 */
export const AI_PRICES = {
  inputPerMTokUsd: 0.28,
  cachedInputPerMTokUsd: 0.028,
  outputPerMTokUsd: 0.42,
  imageUsd: 0.035
} as const;

/** Costo estimado en dólares de un uso de IA. */
export function aiCostUsd(u: Pick<AiUsage, 'images' | 'promptTokens' | 'cachedTokens' | 'completionTokens'>): number {
  const cached = Math.min(u.cachedTokens, u.promptTokens);
  const usd = ((u.promptTokens - cached) * AI_PRICES.inputPerMTokUsd + cached * AI_PRICES.cachedInputPerMTokUsd + u.completionTokens * AI_PRICES.outputPerMTokUsd) / 1_000_000
    + u.images * AI_PRICES.imageUsd;
  return Math.round(usd * 10_000) / 10_000;
}

export const EMPTY_AI_USAGE: AiUsage = { texts: 0, images: 0, promptTokens: 0, cachedTokens: 0, completionTokens: 0 };

/** Fila de costo de IA de un negocio (comparado con el precio de su plan). */
export function aiCostRow(b: Pick<Business, 'id' | 'name' | 'status' | 'plan'>, usage: AiUsage | undefined): AiCostRow {
  const u = usage ?? EMPTY_AI_USAGE;
  const costUsd = aiCostUsd(u);
  const planPriceUsd = planPriceCents(b.plan) / 100;
  return {
    businessId: b.id, businessName: adminDisplayName(b), plan: b.plan, texts: u.texts, images: u.images,
    promptTokens: u.promptTokens, cachedTokens: u.cachedTokens, completionTokens: u.completionTokens,
    costUsd, planPriceUsd, ratio: planPriceUsd > 0 ? Math.round((costUsd / planPriceUsd) * 10_000) / 10_000 : 0
  };
}

/** Costo de IA de la plataforma: solo negocios con uso, del más caro al más barato. */
export function buildAiCosts(businesses: Pick<Business, 'id' | 'name' | 'status' | 'plan'>[], usage: Record<string, AiUsage>): { totalCostUsd: number; businesses: AiCostRow[] } {
  const rows = businesses
    .filter((b) => { const u = usage[b.id]; return !!u && u.texts + u.images > 0; })
    .map((b) => aiCostRow(b, usage[b.id]))
    .sort((a, b) => b.costUsd - a.costUsd || a.businessName.localeCompare(b.businessName, 'es'));
  return { totalCostUsd: Math.round(rows.reduce((s, r) => s + r.costUsd, 0) * 10_000) / 10_000, businesses: rows };
}

/* ===================================== Resumen completo ===================================== */

export interface AdminInsightsInput {
  now: number;
  /** Filas del admin con stats.stamps7d, stats.lastStampAt, ownerPhone e inviteExpiresAt. */
  rows: AdminBusinessRow[];
  /** Conteos por clave (ver seriesKeyOf): días 'YYYY-MM-DD', semanas = lunes 'YYYY-MM-DD', meses 'YYYY-MM'. */
  counts: {
    businessesByMonth: Record<string, number>;
    customersByWeek: Record<string, number>;
    stampsByDay: Record<string, number>;
    redemptionsByDay: Record<string, number>;
  };
  /** Al menos los pagos de los últimos 6 meses. */
  payments: Pick<AdminPayment, 'amountCents' | 'paidAt'>[];
  /** Uso de IA del mes actual por negocio. */
  aiUsage: Record<string, AiUsage>;
}

/** Arma AdminInsights. Lo usan los dos repos con los mismos datos de entrada. */
export function buildAdminInsights(input: AdminInsightsInput): AdminInsights {
  const { now, rows, counts } = input;
  const money = buildMoney(rows, now);
  const collected = collectedByMonth(input.payments, now, 6);
  const health = buildHealth(rows, now);
  return {
    generatedAt: new Date(now).toISOString(),
    tasks: buildAdminTasks(rows, now),
    money: { ...money, collectedThisMonthCents: collected.thisMonthCents, collectedByMonth: collected.series },
    health,
    ranking: rankBusinesses(health.businesses, 5),
    series: {
      businessesByMonth: fillSeries('month', 12, now, counts.businessesByMonth),
      customersByWeek: fillSeries('week', 12, now, counts.customersByWeek),
      stampsByDay: fillSeries('day', 90, now, counts.stampsByDay),
      redemptionsByDay: fillSeries('day', 90, now, counts.redemptionsByDay)
    },
    ai: { since: ecMonthStartIso(now), ...buildAiCosts(rows.map((r) => r.business), input.aiUsage) }
  };
}

/* ===================================== Pagos ===================================== */

export const PAYMENT_METHODS: PaymentMethod[] = ['transferencia', 'efectivo', 'tarjeta', 'otro'];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro'
};
export const MAX_PAYMENT_MONTHS = 24;
export const MAX_PAYMENT_CENTS = 1_000_000;   // $10.000: tope defensivo

export interface ExpiryPlanInput {
  /** Vencimiento actual (ISO) o undefined si no tiene. */
  currentExpiresAt?: string;
  /** 'YYYY-MM-DD' */
  paidAt: string;
  months?: number;
  /** 'YYYY-MM-DD' o ISO. */
  newExpiresAt?: string;
}

/**
 * Nuevo vencimiento al registrar un pago.
 * - newExpiresAt: esa fecha ('YYYY-MM-DD' -> 23:59:59 de Ecuador). months = null.
 * - months (por defecto 1): base = el día más tardío entre el vencimiento actual y el día del pago (en Ecuador); nuevo
 *   vencimiento = base + N meses, a las 23:59:59 de Ecuador.
 */
export function nextPlanExpiry(input: ExpiryPlanInput): { expiresAt: string; months: number | null } {
  if (input.newExpiresAt) {
    const iso = isDayKey(input.newExpiresAt) ? ecEndOfDayIso(input.newExpiresAt) : new Date(input.newExpiresAt).toISOString();
    return { expiresAt: iso, months: null };
  }
  const months = input.months ?? 1;
  const paidDay = input.paidAt;
  const currentDay = input.currentExpiresAt ? ecDayKey(input.currentExpiresAt) : null;
  const baseDay = currentDay && currentDay > paidDay ? currentDay : paidDay;
  return { expiresAt: ecEndOfDayIso(addMonthsToDay(baseDay, months)), months };
}

/**
 * Monto escrito por el admin -> centavos (0 si no se entiende). Acepta "54,99", "54.99", "$ 54", "1.319,76", "1,319.76"
 * y "1.000". El último separador seguido de 1 o 2 cifras es el decimal; seguido de 3 cifras, es de miles.
 * A diferencia de parseMoney, nunca lee "1.319,76" como 1,31 ni ignora letras al final.
 */
export function parseAmountCents(input: string): number {
  const s = String(input ?? '').replace(/\$/g, '').replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return 0;
  const sep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let intPart = s;
  let dec = '';
  if (sep >= 0 && s.length - sep - 1 <= 2) { intPart = s.slice(0, sep); dec = s.slice(sep + 1); }
  if (/[.,]/.test(intPart) && !/^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.test(intPart)) return 0;
  if (dec && intPart.includes(s[sep])) return 0;   // "1.234.56": el separador decimal no puede repetirse
  const cents = Number(intPart.replace(/[.,]/g, '')) * 100 + Number(dec.padEnd(2, '0') || '0');
  return Number.isSafeInteger(cents) && cents > 0 ? cents : 0;
}

/** Valida un pago. Devuelve { field, error } con el primer problema (mensajes en español) o null. */
export function validatePayment(
  input: Pick<NewPaymentLike, 'amountCents' | 'paidAt' | 'method' | 'months' | 'newExpiresAt' | 'note' | 'plan'>,
  nowMs: number = Date.now()
): { field: 'amount' | 'paidAt' | 'method' | 'months' | 'newExpiresAt' | 'note' | 'plan'; error: string } | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { field: 'amount', error: 'Escribe el monto pagado.' };
  if (input.amountCents > MAX_PAYMENT_CENTS) return { field: 'amount', error: 'El monto es demasiado alto. Revísalo.' };
  if (!isDayKey(input.paidAt)) return { field: 'paidAt', error: 'Elige la fecha del pago.' };
  if (input.paidAt > ecDayKey(nowMs)) return { field: 'paidAt', error: 'La fecha del pago no puede ser futura.' };
  if (input.paidAt < '2020-01-01') return { field: 'paidAt', error: 'La fecha del pago no es válida.' };
  if (!PAYMENT_METHODS.includes(input.method)) return { field: 'method', error: 'Elige cómo pagó.' };
  if (input.plan !== undefined && !PLANS.includes(input.plan)) return { field: 'plan', error: 'Elige un plan válido.' };
  if (input.newExpiresAt !== undefined && input.newExpiresAt !== '') {
    const t = isDayKey(input.newExpiresAt) ? Date.parse(ecEndOfDayIso(input.newExpiresAt)) : Date.parse(input.newExpiresAt);
    if (!Number.isFinite(t)) return { field: 'newExpiresAt', error: 'La nueva fecha de vencimiento no es válida.' };
    if (t <= nowMs) return { field: 'newExpiresAt', error: 'La nueva fecha de vencimiento debe ser futura.' };
    if (input.months !== undefined) return { field: 'months', error: 'Elige meses o una fecha, no las dos cosas.' };
  } else if (input.months !== undefined && (!Number.isInteger(input.months) || input.months < 1 || input.months > MAX_PAYMENT_MONTHS)) {
    return { field: 'months', error: `Elige entre 1 y ${MAX_PAYMENT_MONTHS} meses.` };
  }
  if (input.note !== undefined && input.note.length > 500) return { field: 'note', error: 'La nota puede tener hasta 500 letras.' };
  return null;
}
type NewPaymentLike = {
  amountCents: number; paidAt: string; method: PaymentMethod; months?: number; newExpiresAt?: string; note?: string; plan?: Plan;
};

/* ===================================== Historial de acciones ===================================== */

export const ADMIN_ACTION_LABEL: Record<AdminActionKind, string> = {
  access_created: 'Acceso creado',
  suspended: 'Suspendido',
  reactivated: 'Reactivado',
  plan_changed: 'Cambio de plan',
  expiry_changed: 'Cambio de vencimiento',
  payment_recorded: 'Pago registrado',
  access_resent: 'Acceso reenviado',
  note_changed: 'Nota editada',
  phone_changed: 'Teléfono editado'
};

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const planName = (v: unknown) => (typeof v === 'string' && v in PLAN_LABEL ? PLAN_LABEL[v as Plan] : str(v));
const dateOrNone = (v: unknown) => (typeof v === 'string' && v ? ecDateLabel(v) : 'sin vencimiento');

/**
 * Frase en español de una acción del admin. Claves de `detail` que entiende cada tipo:
 *  access_created { email, plan } · suspended {} · reactivated { status } · plan_changed { from, to }
 *  · expiry_changed { from, to, autoRenew? } · payment_recorded { amountCents, months, newExpiresAt, method }
 *  · access_resent { kind: 'invite' | 'reset', email } · note_changed {} · phone_changed { from, to }
 */
export function adminActionSummary(kind: AdminActionKind, detail: Record<string, unknown> = {}): string {
  switch (kind) {
    case 'access_created':
      return `Dio acceso a ${str(detail.email) ?? 'un dueño'}${detail.plan ? ` con el plan ${planName(detail.plan)}` : ''}.`;
    case 'suspended': return 'Suspendió el negocio.';
    case 'reactivated': return detail.status === 'setup' ? 'Reactivó el negocio (sigue configurando).' : 'Reactivó el negocio.';
    case 'plan_changed': return `Cambió el plan de ${planName(detail.from) ?? '—'} a ${planName(detail.to) ?? '—'}.`;
    case 'expiry_changed': {
      const parts: string[] = [];
      if ('to' in detail || 'from' in detail) parts.push(`Cambió el vencimiento de ${dateOrNone(detail.from)} a ${dateOrNone(detail.to)}.`);
      if (typeof detail.autoRenew === 'boolean') parts.push(detail.autoRenew ? 'Activó la renovación mensual.' : 'Quitó la renovación mensual.');
      return parts.join(' ') || 'Cambió el vencimiento.';
    }
    case 'payment_recorded': {
      const amount = typeof detail.amountCents === 'number' ? formatCents(detail.amountCents) : 'un pago';
      const method = typeof detail.method === 'string' && detail.method in PAYMENT_METHOD_LABEL ? ` (${PAYMENT_METHOD_LABEL[detail.method as PaymentMethod].toLowerCase()})` : '';
      const months = typeof detail.months === 'number' ? ` por ${detail.months} ${detail.months === 1 ? 'mes' : 'meses'}` : '';
      const until = typeof detail.newExpiresAt === 'string' ? `; vence el ${ecDateLabel(detail.newExpiresAt)}` : '';
      return `Registró ${amount}${method}${months}${until}.`;
    }
    case 'access_resent':
      return `${detail.kind === 'reset' ? 'Envió un enlace para cambiar la contraseña' : 'Reenvió la invitación'}${str(detail.email) ? ` a ${detail.email}` : ''}.`;
    case 'note_changed': return 'Editó la nota interna.';
    case 'phone_changed':
      return detail.to ? `Guardó el celular ${str(detail.to)}.` : 'Borró el celular del dueño.';
    default: return 'Acción del administrador.';
  }
}
