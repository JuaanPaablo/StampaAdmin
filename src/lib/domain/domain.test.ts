import { describe, expect, it } from 'vitest';
import type { Program, StampCode } from '../contracts';
import { getTemplate } from '../templates';
import {
  codeStatus, flagStaff, generateCode, maxSeats, needsApproval, segmentOf, validateNewCode
} from './index';

const cafe: Program = { businessId: 'b', logoText: 'CE', ...getTemplate('cafeteria').program };
const gym: Program = { businessId: 'g', logoText: 'GP', ...getTemplate('gimnasio').program };
const NOW = new Date('2026-11-18T15:00:00Z');
const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const DAY = 86_400_000;

const claim = (n: number, voided = false) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, codeId: 'x', customerId: `u${i}`, customerName: 'U', at: iso(-1000), ...(voided ? { voidedAt: iso(-500), voidedBy: 's' } : {}) }));
const code = (o: Partial<Pick<StampCode, 'claims' | 'seats' | 'expiresAt' | 'cancelledAt'>> = {}) =>
  ({ claims: [], seats: 3, expiresAt: iso(60_000), ...o });

describe('maxSeats', () => {
  it('cupos por monto: floor(monto / mínimo por sello)', () => {
    expect(maxSeats(1000, cafe)).toBe(4);       // $10 con $2,50 por sello
    expect(maxSeats(999, cafe)).toBe(3);
    expect(maxSeats(249, cafe)).toBe(0);
    expect(maxSeats(-5, cafe)).toBe(0);
  });
  it('gimnasio sin monto: tope max(10, sin aprobación x 2)', () => {
    expect(maxSeats(0, gym)).toBe(10);
    expect(maxSeats(0, { ...gym, maxSeatsWithoutApproval: 8 })).toBe(16);
  });
});

describe('needsApproval', () => {
  it('solo cuando supera los cupos sin aprobación', () => {
    expect(needsApproval(cafe, 4)).toBe(false);
    expect(needsApproval(cafe, 5)).toBe(true);
  });
});

describe('validateNewCode', () => {
  const none = new Set<string>();
  it('acepta un ticket válido', () => {
    expect(validateNewCode(cafe, { ticket: 'T-1', amountCents: 1000, seats: 4 }, none)).toEqual({ ok: true });
  });
  it('rechaza ticket vacío o repetido (sin importar mayúsculas ni espacios)', () => {
    expect(validateNewCode(cafe, { ticket: '  ', amountCents: 1000, seats: 1 }, none)).toMatchObject({ ok: false, field: 'ticket' });
    const r = validateNewCode(cafe, { ticket: ' t-9 ', amountCents: 1000, seats: 1 }, new Set(['T-9']));
    expect(r).toMatchObject({ ok: false, field: 'ticket' });
    expect(!r.ok && r.error).toContain('ya generó un código');
  });
  it('valida el monto', () => {
    expect(validateNewCode(cafe, { ticket: 'A', amountCents: 0, seats: 1 }, none)).toMatchObject({ ok: false, field: 'amount' });
    const low = validateNewCode(cafe, { ticket: 'A', amountCents: 100, seats: 1 }, none);
    expect(low).toMatchObject({ ok: false, field: 'amount' });
    expect(!low.ok && low.error).toContain('$2,50');
  });
  it('limita los cupos por monto', () => {
    const r = validateNewCode(cafe, { ticket: 'A', amountCents: 500, seats: 3 }, none);
    expect(r).toMatchObject({ ok: false, field: 'seats' });
    expect(!r.ok && r.error).toContain('2 cupos');
    expect(validateNewCode(cafe, { ticket: 'A', amountCents: 500, seats: 0 }, none)).toMatchObject({ ok: false, field: 'seats' });
  });
  it('gimnasio: no pide monto y el tope es 10', () => {
    expect(validateNewCode(gym, { ticket: 'F-1', amountCents: 0, seats: 10 }, none)).toEqual({ ok: true });
    const r = validateNewCode(gym, { ticket: 'F-1', amountCents: 0, seats: 11 }, none);
    expect(r).toMatchObject({ ok: false, field: 'seats' });
  });
});

describe('codeStatus', () => {
  it('activo', () => expect(codeStatus(code(), NOW)).toBe('activo'));
  it('vencido por tiempo', () => expect(codeStatus(code({ expiresAt: iso(-1) }), NOW)).toBe('vencido'));
  it('agotado al llenarse los cupos', () => expect(codeStatus(code({ claims: claim(3) }), NOW)).toBe('agotado'));
  it('los sellos anulados siguen ocupando cupo', () => expect(codeStatus(code({ claims: claim(3, true) }), NOW)).toBe('agotado'));
  it('cancelado gana sobre agotado y vencido', () => {
    expect(codeStatus(code({ claims: claim(3), expiresAt: iso(-1), cancelledAt: iso(-10) }), NOW)).toBe('cancelado');
  });
  it('agotado gana sobre vencido', () => expect(codeStatus(code({ claims: claim(3), expiresAt: iso(-1) }), NOW)).toBe('agotado'));
});

describe('flagStaff', () => {
  const row = (staffId: string, tickets: number, stamps: number) => ({ staffId, name: staffId, tickets, stamps, voids: 0 });
  it('marca a quien supera 1,5 x la mediana con 5+ tickets', () => {
    const r = flagStaff([row('pedro', 9, 22), row('marco', 30, 36), row('lucia', 28, 33)]);
    expect(r.find((x) => x.staffId === 'pedro')).toMatchObject({ flagged: true });
    expect(r.find((x) => x.staffId === 'pedro')!.ratio).toBeCloseTo(22 / 9, 5);
    expect(r.filter((x) => x.flagged)).toHaveLength(1);
  });
  it('no marca con menos de 5 tickets aunque el ratio sea alto', () => {
    const r = flagStaff([row('a', 4, 20), row('b', 30, 36), row('c', 28, 33)]);
    expect(r.every((x) => !x.flagged)).toBe(true);
  });
  it('no marca si el equipo es parejo ni con equipo vacío', () => {
    expect(flagStaff([row('a', 10, 12), row('b', 10, 13)]).every((x) => !x.flagged)).toBe(true);
    expect(flagStaff([])).toEqual([]);
  });
  it('quien no tiene tickets queda en ratio 0 y no cuenta para la mediana', () => {
    const r = flagStaff([row('a', 0, 0), row('b', 10, 10)]);
    expect(r[0]).toMatchObject({ ratio: 0, flagged: false });
  });
});

describe('segmentOf', () => {
  const at = (days: number) => iso(-days * DAY);
  const c = (created: number, last: number | undefined, stamps = 2) => ({ createdAt: at(created), lastVisitAt: last === undefined ? undefined : at(last), stamps });
  it('por canjear gana a todo', () => expect(segmentOf(c(3, 1, 10), cafe, NOW)).toBe('por_canjear'));
  it('nuevo: creado hace menos de 14 días', () => {
    expect(segmentOf(c(13, 1), cafe, NOW)).toBe('nuevo');
    expect(segmentOf(c(14, 1), cafe, NOW)).toBe('activo');
  });
  it('activo, en riesgo e inactivo según la última visita', () => {
    expect(segmentOf(c(100, 20), cafe, NOW)).toBe('activo');
    expect(segmentOf(c(100, 21), cafe, NOW)).toBe('en_riesgo');
    expect(segmentOf(c(100, 45), cafe, NOW)).toBe('en_riesgo');
    expect(segmentOf(c(100, 46), cafe, NOW)).toBe('inactivo');
  });
  it('sin visitas cuenta desde la creación', () => expect(segmentOf(c(60, undefined), cafe, NOW)).toBe('inactivo'));
});

describe('generateCode', () => {
  it('genera 6 dígitos', () => expect(generateCode(new Set())).toMatch(/^\d{6}$/));
  it('nunca repite uno existente', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) { const c = generateCode(seen); expect(seen.has(c)).toBe(false); seen.add(c); }
  });
  it('evita un código ocupado aunque el azar insista', () => {
    expect(generateCode(new Set(['123456']), (() => { let i = 0; return () => (i++ === 0 ? (123456 - 100000) / 900000 + 1e-9 : 0.5); })())).not.toBe('123456');
  });
});
