import type { AccessTokenKind, AdminBusinessRow, Business, BusinessHealth, BusinessStatus, Plan, Role } from '@/lib/contracts';
import { HEALTH_LABEL, businessHealth, daysSince, ecDayKey, formatCents, planPriceCents } from '@/lib/domain/admin-insights';
import { PLACEHOLDER_BUSINESS_NAME, PLANS, PLAN_LABEL, businessStatus } from '@/lib/mvp-rules';
import { localEcPhone } from '@/lib/phone';

/** Lógica pura del panel de administrador (sin servidor ni React). Probada en helpers.test.ts. */

/** Ecuador continental: UTC-5 todo el año (sin horario de verano). */
const EC_OFFSET_MS = -5 * 3_600_000;
const DAY = 86_400_000;

export const STATUS_LABEL: Record<BusinessStatus, string> = { setup: 'Configurando', active: 'Activo', suspended: 'Suspendido' };
export const STATUS_TONE: Record<BusinessStatus, 'warn' | 'ok' | 'bad'> = { setup: 'warn', active: 'ok', suspended: 'bad' };

/** Nombre para mostrar: los negocios que aún no terminan el asistente dicen "Negocio nuevo · configurando". */
export function displayName(b: Pick<Business, 'name' | 'status'>): string {
  if (businessStatus(b) === 'setup' && (!b.name || b.name === PLACEHOLDER_BUSINESS_NAME)) return `${PLACEHOLDER_BUSINESS_NAME} · configurando`;
  return b.name;
}

/** Día calendario en Ecuador (número de días desde 1970) de un instante. */
const ecDay = (ms: number) => Math.floor((ms + EC_OFFSET_MS) / DAY);

export type ExpiryTone = 'none' | 'ok' | 'warn' | 'bad';
export interface ExpiryInfo { tone: ExpiryTone; label: string; days: number | null }

/** Aviso de vencimiento: rojo si ya venció, ámbar si vence en 7 días o menos (en días calendario de Ecuador). */
export function expiryInfo(planExpiresAt: string | undefined, nowMs: number = Date.now()): ExpiryInfo {
  if (!planExpiresAt) return { tone: 'none', label: 'Sin vencimiento', days: null };
  const exp = Date.parse(planExpiresAt);
  if (Number.isNaN(exp)) return { tone: 'none', label: 'Sin vencimiento', days: null };
  const days = ecDay(exp) - ecDay(nowMs);
  if (exp <= nowMs) {
    const ago = -days;
    return { tone: 'bad', label: ago <= 0 ? 'Venció hoy' : ago === 1 ? 'Venció ayer' : `Venció hace ${ago} días`, days };
  }
  if (days <= 0) return { tone: 'warn', label: 'Vence hoy', days: 0 };
  if (days === 1) return { tone: 'warn', label: 'Vence mañana', days };
  if (days <= 7) return { tone: 'warn', label: `Vence en ${days} días`, days };
  return { tone: 'ok', label: `Vence el ${formatDate(planExpiresAt)}`, days };
}

/** "21 nov 2026" en hora de Ecuador. */
export function formatDate(iso: string): string {
  const d = new Date(Date.parse(iso) + EC_OFFSET_MS);
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Valor para <input type="date"> (YYYY-MM-DD en hora de Ecuador). */
export function toDateInput(iso: string | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  return new Date(Date.parse(iso) + EC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Lee el valor de <input type="date">. Vacío = sin vencimiento (null). El plan vence al final de ese día en Ecuador.
 * Devuelve { error } si la fecha no existe o está fuera de rango.
 */
export function parseDateInput(raw: unknown): { value: string | null } | { error: string } {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { value: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return { error: 'La fecha no es válida.' };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return { error: 'La fecha no es válida.' };
  if (y < 2020 || y > 2100) return { error: 'La fecha no es válida.' };
  return { value: new Date(Date.UTC(y, mo - 1, d, 23, 59, 59) - EC_OFFSET_MS).toISOString() };
}

/* ---------- Lista de negocios: búsqueda y filtro por query string ---------- */

export type StatusFilter = 'todos' | 'configurando' | 'activos' | 'suspendidos' | 'por-vencer' | 'vencidos';
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'configurando', label: 'Configurando' },
  { value: 'activos', label: 'Activos' },
  { value: 'suspendidos', label: 'Suspendidos' },
  { value: 'por-vencer', label: 'Por vencer' },
  { value: 'vencidos', label: 'Vencidos' }
];

export function parseStatusFilter(raw: unknown): StatusFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return STATUS_FILTERS.some((f) => f.value === v) ? (v as StatusFilter) : 'todos';
}

export function parseSearch(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' ? v.trim().slice(0, 100) : '';
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Dígitos de la búsqueda si parece un teléfono (solo dígitos y signos de teléfono, 4 dígitos o más). */
const phoneNeedle = (q: string): string | null => {
  const digits = q.replace(/\D/g, '');
  return digits.length >= 4 && /^[\d\s+().-]+$/.test(q) ? digits : null;
};

/** Busca por nombre, dirección pública (slug), dueño, correo y celular (en cualquier formato: 099…, +593…). */
export function matchesSearch(r: AdminBusinessRow, q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  const hay = fold([r.business.name, r.owner?.email ?? '', r.owner?.name ?? '', r.business.slug].join(' '));
  if (hay.includes(needle)) return true;
  const digits = phoneNeedle(q.trim());
  if (digits && r.ownerPhone) {
    const e164 = r.ownerPhone.replace(/\D/g, '');
    const local = localEcPhone(r.ownerPhone).replace(/\D/g, '');
    return e164.includes(digits) || local.includes(digits);
  }
  return false;
}

export function filterRows(rows: AdminBusinessRow[], q: string, status: StatusFilter, nowMs: number = Date.now()): AdminBusinessRow[] {
  return rows.filter((r) => {
    if (!matchesSearch(r, q)) return false;
    const st = businessStatus(r.business);
    const exp = expiryInfo(r.business.planExpiresAt, nowMs);
    switch (status) {
      case 'configurando': return st === 'setup';
      case 'activos': return st === 'active';
      case 'suspendidos': return st === 'suspended';
      case 'por-vencer': return st !== 'suspended' && exp.tone === 'warn';
      case 'vencidos': return st !== 'suspended' && exp.tone === 'bad';
      default: return true;
    }
  });
}

/* ---------- Lista de negocios: salud, plan y orden ---------- */

/** Semáforo de una fila de la lista (mismas reglas que el resumen). */
export function rowHealth(r: AdminBusinessRow, nowMs: number = Date.now()): BusinessHealth {
  const b = r.business;
  return businessHealth({ status: b.status, createdAt: b.createdAt, setupCompletedAt: b.setupCompletedAt, lastStampAt: r.stats.lastStampAt }, nowMs);
}

export type HealthFilter = 'todos' | 'verde' | 'amarillo' | 'rojo';
export const HEALTH_FILTERS: { value: HealthFilter; label: string; health?: BusinessHealth }[] = [
  { value: 'todos', label: 'Toda la actividad' },
  { value: 'verde', label: HEALTH_LABEL.green, health: 'green' },
  { value: 'amarillo', label: HEALTH_LABEL.yellow, health: 'yellow' },
  { value: 'rojo', label: HEALTH_LABEL.red, health: 'red' }
];

export function parseHealthFilter(raw: unknown): HealthFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return HEALTH_FILTERS.some((f) => f.value === v) ? (v as HealthFilter) : 'todos';
}

export type PlanFilter = 'todos' | Plan;
export function parsePlanFilter(raw: unknown): PlanFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (PLANS as string[]).includes(v as string) ? (v as Plan) : 'todos';
}

export type SortKey = 'nombre' | 'clientes' | 'sellos30' | 'ultimo-sello' | 'vence' | 'creado';
export type SortDir = 'asc' | 'desc';
/** Dirección con la que arranca cada columna al ordenarla (lo más útil primero). */
export const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  nombre: 'asc', clientes: 'desc', sellos30: 'desc', 'ultimo-sello': 'desc', vence: 'asc', creado: 'desc'
};
export const DEFAULT_SORT: SortKey = 'creado';
export const SORT_LABEL: Record<SortKey, string> = {
  nombre: 'Nombre', clientes: 'Clientes', sellos30: 'Sellos 30 días', 'ultimo-sello': 'Último sello', vence: 'Vencimiento', creado: 'Fecha de alta'
};

export function parseSort(raw: unknown): SortKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SORT_DEFAULT_DIR, v) ? (v as SortKey) : DEFAULT_SORT;
}
export function parseDir(raw: unknown, key: SortKey): SortDir {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'asc' || v === 'desc' ? v : SORT_DEFAULT_DIR[key];
}

export interface ListParams { q: string; estado: StatusFilter; salud: HealthFilter; plan: PlanFilter; orden: SortKey; dir: SortDir }

/** Lee los filtros y el orden de la lista desde la query string (valores desconocidos = por defecto). */
export function parseListParams(sp: Record<string, string | string[] | undefined> | URLSearchParams | undefined): ListParams {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? undefined : sp?.[k]);
  // `ordenar` ("clientes.desc") viene del selector "Ordenar por" del formulario; gana sobre orden y dir.
  const rawCombo = get('ordenar');
  const comboStr = Array.isArray(rawCombo) ? rawCombo[0] : rawCombo;
  const combo = typeof comboStr === 'string' ? comboStr.slice(0, 30).split('.') : [];
  const fromCombo = combo.length === 2 && parseSort(combo[0]) === combo[0] && (combo[1] === 'asc' || combo[1] === 'desc');
  const orden = fromCombo ? (combo[0] as SortKey) : parseSort(get('orden'));
  return {
    q: parseSearch(get('q')), estado: parseStatusFilter(get('estado')), salud: parseHealthFilter(get('salud')),
    plan: parsePlanFilter(get('plan')), orden, dir: fromCombo ? (combo[1] as SortDir) : parseDir(get('dir'), orden)
  };
}

/** Opciones del selector "Ordenar por" (valor "clave.dirección"). */
export const SORT_OPTIONS: { value: `${SortKey}.${SortDir}`; label: string }[] = [
  { value: 'creado.desc', label: 'Más nuevos primero' },
  { value: 'creado.asc', label: 'Más antiguos primero' },
  { value: 'nombre.asc', label: 'Nombre (A a Z)' },
  { value: 'nombre.desc', label: 'Nombre (Z a A)' },
  { value: 'clientes.desc', label: 'Más clientes' },
  { value: 'clientes.asc', label: 'Menos clientes' },
  { value: 'sellos30.desc', label: 'Más sellos en 30 días' },
  { value: 'sellos30.asc', label: 'Menos sellos en 30 días' },
  { value: 'ultimo-sello.desc', label: 'Sello más reciente' },
  { value: 'ultimo-sello.asc', label: 'Sello más antiguo' },
  { value: 'vence.asc', label: 'Vence antes' },
  { value: 'vence.desc', label: 'Vence después' }
];

/** Query string con solo lo que no es el valor por defecto ('' si no hay nada; si hay, empieza con '?'). */
export function listQuery(p: ListParams, patch: Partial<ListParams> = {}): string {
  const v = { ...p, ...patch };
  const params = new URLSearchParams();
  if (v.q) params.set('q', v.q);
  if (v.estado !== 'todos') params.set('estado', v.estado);
  if (v.salud !== 'todos') params.set('salud', v.salud);
  if (v.plan !== 'todos') params.set('plan', v.plan);
  if (v.orden !== DEFAULT_SORT || v.dir !== SORT_DEFAULT_DIR[v.orden]) {
    params.set('orden', v.orden);
    if (v.dir !== SORT_DEFAULT_DIR[v.orden]) params.set('dir', v.dir);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Filtra por búsqueda, estado, salud y plan. */
export function applyListFilters(rows: AdminBusinessRow[], p: Pick<ListParams, 'q' | 'estado' | 'salud' | 'plan'>, nowMs: number = Date.now()): AdminBusinessRow[] {
  const want = HEALTH_FILTERS.find((f) => f.value === p.salud)?.health;
  return filterRows(rows, p.q, p.estado, nowMs).filter((r) =>
    (p.plan === 'todos' || r.business.plan === p.plan) && (!want || rowHealth(r, nowMs) === want));
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Ordena sin mutar. Lo que no tiene valor (sin sellos, sin vencimiento) va siempre al final. Empates: por nombre. */
export function sortRows(rows: AdminBusinessRow[], key: SortKey, dir: SortDir): AdminBusinessRow[] {
  const val = (r: AdminBusinessRow): number | string | undefined => {
    switch (key) {
      case 'nombre': return displayName(r.business);
      case 'clientes': return r.stats.customers;
      case 'sellos30': return r.stats.stamps30d;
      case 'ultimo-sello': return r.stats.lastStampAt ? Date.parse(r.stats.lastStampAt) : undefined;
      case 'vence': return r.business.planExpiresAt ? Date.parse(r.business.planExpiresAt) : undefined;
      case 'creado': return Date.parse(r.business.createdAt);
    }
  };
  const missing = (v: number | string | undefined) => v === undefined || (typeof v === 'number' && Number.isNaN(v));
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r) => ({ r, v: val(r) }))
    .sort((a, b) => {
      const am = missing(a.v), bm = missing(b.v);
      if (am !== bm) return am ? 1 : -1;
      let c = 0;
      if (!am) c = typeof a.v === 'string' ? collator.compare(a.v, String(b.v)) : (a.v as number) - (b.v as number);
      return c * sign || collator.compare(displayName(a.r.business), displayName(b.r.business));
    })
    .map((x) => x.r);
}

/** "hoy" / "ayer" / "hace 3 días" / "Nunca selló", en días calendario de Ecuador. */
export function lastStampText(lastStampAt: string | undefined, nowMs: number = Date.now()): string {
  const d = daysSince(lastStampAt, nowMs);
  if (d === null) return 'Nunca selló';
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
}

/* ---------- Ficha del negocio ---------- */

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', manager: 'Gerente', cashier: 'Cajero' };

/** Estado de acceso al panel de una persona del equipo. */
export function staffAccessLabel(s: { email?: string; hasPassword: boolean; invitePending: boolean }): string {
  if (s.hasPassword) return 'Con contraseña';
  if (s.invitePending) return 'Invitación pendiente';
  return s.email ? 'Sin contraseña' : 'Sin acceso al panel';
}

/** "25 nov 2026, 14:05" en hora de Ecuador. */
export function formatDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + EC_OFFSET_MS);
  return `${formatDate(iso)}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Hace cuánto, en palabras: "hace un momento", "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = Date.parse(iso);
  const s = Math.max(0, (nowMs - t) / 1000);
  if (s < 90) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = ecDay(nowMs) - ecDay(t);
  return d <= 1 ? 'ayer' : `hace ${d} días`;
}

/** Monto para el campo del formulario de pago: "54,99" (sin símbolo ni separador de miles). */
export function amountInput(cents: number): string {
  return formatCents(cents).replace('$', '').replace(/\./g, '');
}

/** Mensaje prellenado para escribir al dueño por WhatsApp. Si el plan vence pronto o venció, habla del pago. */
export function ownerWhatsappText(row: AdminBusinessRow, nowMs: number = Date.now()): string {
  const first = row.owner?.name?.trim().split(/\s+/)[0];
  const hello = `Hola${first ? ` ${first}` : ''}, te saluda el equipo de Stampa.`;
  const b = row.business;
  const st = businessStatus(b);
  const exp = expiryInfo(b.planExpiresAt, nowMs);
  if (st !== 'suspended' && !b.autoRenew && (exp.tone === 'warn' || exp.tone === 'bad') && b.planExpiresAt) {
    const when = exp.tone === 'bad' ? `venció el ${formatDate(b.planExpiresAt)}` : `vence el ${formatDate(b.planExpiresAt)}`;
    return `${hello} Tu plan ${PLAN_LABEL[b.plan]} ${when}. Para renovarlo son ${formatCents(planPriceCents(b.plan))} al mes. ¿Te ayudo con el pago?`;
  }
  if (st === 'setup') return `${hello} ¿Te ayudo a terminar de configurar tu negocio?`;
  return `${hello} ¿Cómo te va con ${displayName(b)}? Si necesitas algo, aquí estamos.`;
}

/* ---------- Exportar la lista a CSV ---------- */

/** Escapa para CSV y neutraliza fórmulas (=, +, -, @, tab, retorno) para que Excel no las ejecute. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export const BUSINESS_CSV_HEADER = [
  'Negocio', 'Dirección pública', 'Estado', 'Plan', 'Precio mensual', 'Vence', 'Renueva cada mes', 'Actividad', 'Último sello',
  'Días sin sellos', 'Clientes', 'Sellos 7 días', 'Sellos 30 días', 'Canjes 30 días', 'Dueño', 'Correo del dueño',
  'Celular del dueño', 'Acceso del dueño', 'Alta', 'Nota interna'
];

/** CSV (con BOM para Excel y fin de línea CRLF) de las filas ya filtradas y ordenadas. */
export function businessesCsv(rows: AdminBusinessRow[], nowMs: number = Date.now()): string {
  const day = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? ecDayKey(iso) : '');
  const lines = [BUSINESS_CSV_HEADER.map(csvCell).join(',')];
  for (const r of rows) {
    const b = r.business;
    const d = daysSince(r.stats.lastStampAt, nowMs);
    lines.push([
      displayName(b), b.slug, STATUS_LABEL[businessStatus(b)], PLAN_LABEL[b.plan], formatCents(planPriceCents(b.plan)),
      day(b.planExpiresAt), b.autoRenew ? 'Sí' : 'No', HEALTH_LABEL[rowHealth(r, nowMs)], day(r.stats.lastStampAt),
      d === null ? '' : d, r.stats.customers, r.stats.stamps7d ?? '', r.stats.stamps30d, r.stats.redemptions30d,
      r.owner?.name ?? '', r.owner?.email ?? '', r.ownerPhone ? localEcPhone(r.ownerPhone) : '',
      r.owner ? (r.owner.invitePending ? 'Invitación pendiente' : 'Con contraseña') : '', day(b.createdAt), r.note ?? ''
    ].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/* ---------- Necesitan atención ---------- */

export type AttentionReason = 'expired' | 'expiring' | 'invite';
export interface AttentionItem { row: AdminBusinessRow; reason: AttentionReason; label: string }

/** Vencidos primero, luego por vencer y luego invitaciones pendientes. Los suspendidos no piden atención. */
export function needsAttention(rows: AdminBusinessRow[], nowMs: number = Date.now(), limit = 8): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const row of rows) {
    if (businessStatus(row.business) === 'suspended') continue;
    const exp = expiryInfo(row.business.planExpiresAt, nowMs);
    if (exp.tone === 'bad') out.push({ row, reason: 'expired', label: exp.label });
    else if (exp.tone === 'warn') out.push({ row, reason: 'expiring', label: exp.label });
    else if (row.owner?.invitePending) out.push({ row, reason: 'invite', label: 'Invitación pendiente' });
  }
  const rank: Record<AttentionReason, number> = { expired: 0, expiring: 1, invite: 2 };
  return out
    .sort((a, b) => rank[a.reason] - rank[b.reason] || (a.row.business.planExpiresAt ?? '').localeCompare(b.row.business.planExpiresAt ?? ''))
    .slice(0, limit);
}

/* ---------- Mensajes para compartir el enlace ---------- */

export function accessShareText(kind: AccessTokenKind, url: string): string {
  return kind === 'invite'
    ? `Hola, ya tienes acceso a Stampa. Crea tu contraseña y configura tu negocio aquí: ${url}`
    : `Hola, este es tu enlace para cambiar tu contraseña de Stampa. Vence en 60 minutos: ${url}`;
}

export type EmailStatus = 'sent' | 'preview' | 'failed';
export function emailStatusOf(result: { sent: boolean; preview?: boolean }): EmailStatus {
  return result.sent ? 'sent' : result.preview ? 'preview' : 'failed';
}

/* Ayuda en vivo de las contraseñas: vive aparte porque la usa un componente de cliente (sin node:crypto). */
export { passwordHint, type PasswordHint } from './password-hint';
