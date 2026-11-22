import { lcfirst } from '@/lib/rewards';
import type { CustomerCard } from '@/lib/contracts';

/** Lógica pura de la tarjeta del cliente (sin React ni Node: también corre en el navegador). Probada en card-model.test.ts. */

/** Misma regla que validateBirthYear de mvp-rules.ts (ese archivo importa node:crypto y no puede ir al navegador). */
function validateBirthYear(year: number, nowMs: number): string | null {
  const current = new Date(nowMs).getUTCFullYear();
  if (!Number.isInteger(year) || year < current - 110 || year > current - 5) return 'El año de nacimiento no es válido.';
  return null;
}

export interface StampCell {
  /** 1..total */
  n: number;
  earned: boolean;
  /** El último casillero: el premio. */
  reward: boolean;
}

/** Casilleros de la tarjeta. `filled` se recorta a 0..total. */
export function stampCells(total: number, filled: number): StampCell[] {
  const t = Math.max(1, Math.floor(total));
  const f = Math.max(0, Math.min(t, Math.floor(filled)));
  return Array.from({ length: t }, (_, i) => ({ n: i + 1, earned: i < f, reward: i === t - 1 }));
}

/** Columnas de la cuadrícula: filas parejas y casilleros grandes en 360 px. */
export function stampColumns(total: number): number {
  if (total <= 4) return total;
  if (total <= 8) return 4;
  if (total <= 10) return 5;
  if (total <= 12) return 6;
  if (total === 16) return 4;
  return 5;
}

/** "Café gratis" → "café gratis" (para usarlo dentro de una frase). */
export function rewardPhrase(reward: string): string {
  return lcfirst((reward ?? '').trim()) || 'premio';
}

export function remainingCount(stamps: number, total: number): number {
  return Math.max(0, total - Math.max(0, stamps));
}

/** "Te faltan 3 sellos para tu café gratis" · "Te falta 1 sello…" · completa: "¡Ya ganaste tu café gratis!". */
export function remainingText(stamps: number, total: number, reward: string): string {
  const left = remainingCount(stamps, total);
  const r = rewardPhrase(reward);
  if (left === 0) return `¡Ya ganaste tu ${r}!`;
  return left === 1 ? `Te falta 1 sello para tu ${r}` : `Te faltan ${left} sellos para tu ${r}`;
}

/** Mensaje al sumar un sello: "¡Sello 7 de 10! Te faltan 3 para tu café gratis." */
export function stampedText(stamps: number, total: number, reward: string): string {
  const s = Math.max(0, Math.min(stamps, total));
  const left = remainingCount(s, total);
  const r = rewardPhrase(reward);
  const head = `¡Sello ${s} de ${total}!`;
  if (left === 0) return `${head} Ya ganaste tu ${r}.`;
  return `${head} Te ${left === 1 ? 'falta 1' : `faltan ${left}`} para tu ${r}.`;
}

/** Iniciales para el logo cuando no hay imagen (máx. 3 letras). */
export function logoInitials(logoText: string | undefined, businessName: string): string {
  const t = (logoText ?? '').trim();
  if (t) return t.slice(0, 3).toUpperCase();
  const words = businessName.trim().split(/\s+/).filter(Boolean);
  const ini = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return ini.toUpperCase();
}

/* ---------- Últimas visitas ---------- */

export interface VisitRow { at: string; label: string; kind: 'stamp' | 'redeem' }

/**
 * Numera los sellos de la tarjeta ACTUAL hacia atrás: el más reciente es "Sello <stamps>". Al cruzar un canje, la
 * numeración sigue en la tarjeta anterior (que terminó completa). Un premio intermedio no reinicia la tarjeta, así que
 * no cambia la numeración.
 */
export function visitRows(recent: CustomerCard['recent'], stamps: number, total: number): VisitRow[] {
  let n = Math.max(0, Math.min(stamps, total));
  const rows: VisitRow[] = [];
  for (const r of recent) {
    if (r.kind === 'redeem') {
      rows.push({ at: r.at, kind: 'redeem', label: r.title ? `Premio canjeado: ${r.title}` : 'Premio canjeado' });
      if (r.milestone == null) n = total;
      continue;
    }
    rows.push({ at: r.at, kind: 'stamp', label: n > 0 ? `Sello ${n}` : 'Sello' });
    n = Math.max(0, n - 1);
  }
  return rows;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTH_NAMES = MONTHS;

function parts(ms: number, tz: string): { y: number; m: number; d: number; h: number; min: number } {
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  } catch {
    f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month - 1, d: p.day, h: p.hour % 24, min: p.minute };
}

/** "Hoy, 10:15" · "Ayer, 8:02" · "2 de noviembre" · "2 de noviembre de 2025" (en la zona del negocio). */
export function visitDate(iso: string, nowMs: number = Date.now(), tz: string = 'America/Guayaquil'): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const a = parts(t, tz);
  const now = parts(nowMs, tz);
  const day = (x: { y: number; m: number; d: number }) => Date.UTC(x.y, x.m, x.d) / 86_400_000;
  const diff = day(now) - day(a);
  const hm = `${a.h}:${String(a.min).padStart(2, '0')}`;
  if (diff === 0) return `Hoy, ${hm}`;
  if (diff === 1) return `Ayer, ${hm}`;
  return a.y === now.y ? `${a.d} de ${MONTHS[a.m]}` : `${a.d} de ${MONTHS[a.m]} de ${a.y}`;
}

/* ---------- Fecha de nacimiento (tres selects) ---------- */

export type BirthCheck = { ok: true; birthday: { d: number; m: number }; year: number } | { ok: false; error: string };

/** d 1..31, m 0..11, año completo. Rechaza fechas imposibles (31 de abril, 29 de febrero en año no bisiesto). */
export function checkBirthdate(d: number, m: number, y: number, nowMs: number = Date.now()): BirthCheck {
  if (![d, m, y].every(Number.isInteger)) return { ok: false, error: 'Elige el día, el mes y el año en que naciste.' };
  if (m < 0 || m > 11 || d < 1 || d > 31) return { ok: false, error: 'La fecha de nacimiento no es válida.' };
  const yearErr = validateBirthYear(y, nowMs);
  if (yearErr) return { ok: false, error: yearErr };
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return { ok: false, error: 'Esa fecha no existe. Revisa el día y el mes.' };
  return { ok: true, birthday: { d, m }, year: y };
}

/** Años para el select (del más reciente permitido hacia atrás). */
export function birthYears(nowMs: number = Date.now()): number[] {
  const current = new Date(nowMs).getUTCFullYear();
  const out: number[] = [];
  for (let y = current - 5; y >= current - 110; y--) out.push(y);
  return out;
}

/** Normaliza un código de 6 dígitos escrito a mano ("123 456" → "123456"); null si no lo es. */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(s) ? s : null;
}
