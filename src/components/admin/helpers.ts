import type { AccessTokenKind, AdminBusinessRow, Business, BusinessStatus } from '@/lib/contracts';
import { PLACEHOLDER_BUSINESS_NAME, businessStatus } from '@/lib/mvp-rules';

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

export function filterRows(rows: AdminBusinessRow[], q: string, status: StatusFilter, nowMs: number = Date.now()): AdminBusinessRow[] {
  const needle = fold(q.trim());
  return rows.filter((r) => {
    if (needle) {
      const hay = fold([r.business.name, r.owner?.email ?? '', r.owner?.name ?? '', r.business.slug].join(' '));
      if (!hay.includes(needle)) return false;
    }
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
