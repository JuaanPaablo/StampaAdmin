import type {
  CodeStatus, Customer, CustomerSegment, Program, StaffReportRow, StampCode
} from '../contracts';
import { DAY_MS } from './dates';
import { cupos, formatMoneyEs, normalizeTicket } from './text';

/**
 * REGLAS DE NEGOCIO PURAS (sin base de datos, sin Next). Las usan memory.ts y supabase.ts, y se prueban con vitest.
 * Los mensajes de error están en español y se repiten tal cual en supabase/migrations/0002_functions.sql:
 * si cambias uno, cámbialo también allí.
 */

export * from './dates';
export * from './text';
export * from './validation';

/** Cupos máximos de un ticket. Si !program.requireAmount devuelve max(10, maxSeatsWithoutApproval * 2) como tope razonable. */
export function maxSeats(amountCents: number, program: Pick<Program, 'requireAmount' | 'minSpendCentsPerStamp' | 'maxSeatsWithoutApproval'>): number {
  if (!program.requireAmount || program.minSpendCentsPerStamp <= 0) {
    return Math.max(10, program.maxSeatsWithoutApproval * 2);
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  return Math.floor(amountCents / program.minSpendCentsPerStamp);
}

/** Prioridad: cancelado > agotado > vencido > activo. Los sellos anulados siguen ocupando cupo. */
export function codeStatus(code: Pick<StampCode, 'claims' | 'seats' | 'expiresAt' | 'cancelledAt'>, now: Date = new Date()): CodeStatus {
  if (code.cancelledAt) return 'cancelado';
  if (code.claims.length >= code.seats) return 'agotado';
  if (Date.parse(code.expiresAt) <= now.getTime()) return 'vencido';
  return 'activo';
}

export function needsApproval(program: Pick<Program, 'maxSeatsWithoutApproval'>, seats: number): boolean {
  return seats > program.maxSeatsWithoutApproval;
}

export type CodeValidation = { ok: true } | { ok: false; error: string; field?: 'ticket' | 'amount' | 'seats' | 'pin' };

/** Valida un código nuevo contra las reglas del programa. existingTickets = tickets ya usados en el negocio. */
export function validateNewCode(
  program: Program,
  input: { ticket: string; amountCents: number; seats: number },
  existingTickets: ReadonlySet<string>
): CodeValidation {
  const ticket = (input.ticket ?? '').trim();
  if (!ticket) return { ok: false, field: 'ticket', error: 'Escribe el número de ticket.' };
  // Se acepta que el conjunto venga con valores crudos o normalizados.
  if (existingTickets.has(ticket) || existingTickets.has(normalizeTicket(ticket))) {
    return { ok: false, field: 'ticket', error: 'Ese ticket ya generó un código. Cada ticket genera un solo código.' };
  }

  const perStamp = program.minSpendCentsPerStamp;
  const amountMatters = program.requireAmount && perStamp > 0;
  if (program.requireAmount) {
    if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
      return { ok: false, field: 'amount', error: 'Escribe el monto del ticket.' };
    }
    if (input.amountCents < perStamp) {
      return { ok: false, field: 'amount', error: `El monto no alcanza para un sello: el mínimo es ${formatMoneyEs(perStamp)} por sello.` };
    }
  }

  if (!Number.isInteger(input.seats) || input.seats < 1) {
    return { ok: false, field: 'seats', error: 'Indica cuántos cupos necesita el ticket (mínimo 1).' };
  }
  const max = maxSeats(program.requireAmount ? input.amountCents : 0, program);
  if (input.seats > max) {
    return {
      ok: false, field: 'seats',
      error: amountMatters
        ? `Con ese monto el máximo es ${cupos(max)} (un sello por cada ${formatMoneyEs(perStamp)}).`
        : `El máximo es ${cupos(max)} por código.`
    };
  }
  return { ok: true };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Mediana del ratio sellos/ticket del equipo (solo quien tiene tickets). */
export function teamMedianRatio(rows: Pick<StaffReportRow, 'tickets' | 'stamps'>[]): number {
  return median(rows.filter((r) => r.tickets > 0).map((r) => r.stamps / r.tickets));
}

/** Marca flagged a quien tenga 5+ tickets y supere 1,5 × la mediana del equipo. Devuelve filas con ratio y flagged calculados. */
export function flagStaff(rows: Omit<StaffReportRow, 'ratio' | 'flagged'>[]): StaffReportRow[] {
  const med = teamMedianRatio(rows);
  return rows.map((r) => {
    const ratio = r.tickets > 0 ? r.stamps / r.tickets : 0;
    return { ...r, ratio, flagged: r.tickets >= 5 && med > 0 && ratio > 1.5 * med };
  });
}

/**
 * por_canjear (tarjeta completa) > nuevo (creado hace menos de 14 días) > activo (visita hace menos de 21 días)
 * > en_riesgo (21 a 45) > inactivo (más de 45). Sin visitas se cuenta desde la creación.
 */
export function segmentOf(customer: Pick<Customer, 'createdAt' | 'lastVisitAt' | 'stamps'>, program: Pick<Program, 'stampsRequired'>, now: Date = new Date()): CustomerSegment {
  if (customer.stamps >= program.stampsRequired) return 'por_canjear';
  const t = now.getTime();
  if ((t - Date.parse(customer.createdAt)) / DAY_MS < 14) return 'nuevo';
  const since = (t - Date.parse(customer.lastVisitAt ?? customer.createdAt)) / DAY_MS;
  if (since < 21) return 'activo';
  if (since <= 45) return 'en_riesgo';
  return 'inactivo';
}

/**
 * 6 dígitos únicos respecto a existing. `rand` es opcional (devuelve [0,1)) para generar datos de ejemplo deterministas;
 * sin él usa crypto.getRandomValues.
 */
export function generateCode(existing: ReadonlySet<string>, rand?: () => number): string {
  const next = rand ?? (() => {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] / 4_294_967_296;
  });
  for (let i = 0; i < 2000; i++) {
    const c = String(100000 + Math.floor(next() * 900000));
    if (!existing.has(c)) return c;
  }
  for (let n = 100000; n <= 999999; n++) {
    const c = String(n);
    if (!existing.has(c)) return c;
  }
  throw new Error('No quedan códigos libres.');
}
