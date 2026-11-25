import { describe, expect, it } from 'vitest';
import type { AdminBusinessRow, Business } from '../contracts';
import {
  addMonthsToDay, adminActionSummary, aiCostRow, aiCostUsd, buildAdminInsights, buildAdminTasks, buildMoney, businessHealth,
  collectedByMonth, countByKey, ecDayKey, ecEndOfDayIso, ecMonthKey, ecMonthStartIso, ecWeekKey, fillSeries, formatCents,
  nextPlanExpiry, parseAmountCents, rankBusinesses, buildHealth, seriesKeys, validatePayment
} from './admin-insights';

const DAY = 86_400_000;
const HOUR = 3_600_000;
// Miércoles 25 nov 2026, 10:00 en Ecuador (15:00 UTC).
const NOW = Date.UTC(2026, 10, 25, 15, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

function row(id: string, b: Partial<Business> = {}, extra: Partial<AdminBusinessRow> & { lastStampAt?: string; stamps30d?: number; invitePending?: boolean } = {}): AdminBusinessRow {
  const { lastStampAt, stamps30d, invitePending, ...rest } = extra;
  return {
    business: {
      id, name: `Negocio ${id}`, slug: id, type: 'cafeteria', country: 'EC', currency: 'USD', timezone: 'America/Guayaquil',
      plan: 'standard', createdAt: iso(NOW - 200 * DAY), status: 'active', setupCompletedAt: iso(NOW - 199 * DAY), ...b
    },
    owner: { staffId: `emp_${id}`, name: 'Dueña', email: `${id}@x.ec`, invitePending: !!invitePending },
    stats: { customers: 10, stamps30d: stamps30d ?? 0, redemptions30d: 0, lastStampAt, stamps7d: 0 },
    ...rest
  };
}

describe('calendario de Ecuador', () => {
  it('día, semana (lunes) y mes en hora de Ecuador', () => {
    // 25 nov 03:00 UTC = 24 nov 22:00 en Ecuador (martes)
    const t = Date.UTC(2026, 10, 25, 3, 0, 0);
    expect(ecDayKey(t)).toBe('2026-11-24');
    expect(ecWeekKey(t)).toBe('2026-11-23');
    expect(ecWeekKey(Date.UTC(2026, 10, 30, 4, 0, 0))).toBe('2026-11-23');   // domingo 29 a las 23:00
    expect(ecWeekKey(Date.UTC(2026, 10, 30, 5, 0, 0))).toBe('2026-11-30');   // lunes 30 a las 00:00
    expect(ecMonthKey(Date.UTC(2026, 11, 1, 2, 0, 0))).toBe('2026-11');      // 30 nov a las 21:00
    expect(ecMonthStartIso(NOW)).toBe('2026-11-01T05:00:00.000Z');
    expect(ecEndOfDayIso('2026-11-30')).toBe('2026-12-01T04:59:59.000Z');
  });

  it('suma meses de calendario sin pasarse de fin de mes', () => {
    expect(addMonthsToDay('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDay('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToDay('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonthsToDay('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('series', () => {
  it('claves completas, de la más antigua a la actual, con ceros', () => {
    const days = seriesKeys('day', 90, NOW);
    expect(days).toHaveLength(90);
    expect(days[89]).toEqual({ key: '2026-11-25', label: '25 nov' });
    expect(days[0].key).toBe('2026-08-28');
    const weeks = seriesKeys('week', 12, NOW);
    expect(weeks).toHaveLength(12);
    expect(weeks[11].key).toBe('2026-11-23');
    expect(weeks[10].key).toBe('2026-11-16');
    const months = seriesKeys('month', 12, NOW);
    expect(months[11]).toEqual({ key: '2026-11', label: 'nov 2026' });
    expect(months[0].key).toBe('2025-12');

    const counts = countByKey('day', [NOW, NOW - HOUR, NOW - 2 * DAY, Date.UTC(2026, 10, 25, 4, 0, 0)]);
    expect(counts).toEqual({ '2026-11-25': 2, '2026-11-23': 1, '2026-11-24': 1 });
    const s = fillSeries('day', 3, NOW, counts);
    expect(s.map((p) => p.value)).toEqual([1, 1, 2]);
  });
});

describe('semáforo de actividad', () => {
  const base = { status: 'active' as const, createdAt: iso(NOW - 100 * DAY), setupCompletedAt: iso(NOW - 99 * DAY) };
  it('verde < 7 días, amarillo de 7 a 14, rojo > 14', () => {
    expect(businessHealth({ ...base, lastStampAt: iso(NOW - 6.9 * DAY) }, NOW)).toBe('green');
    expect(businessHealth({ ...base, lastStampAt: iso(NOW - 7 * DAY) }, NOW)).toBe('yellow');
    expect(businessHealth({ ...base, lastStampAt: iso(NOW - 14 * DAY) }, NOW)).toBe('yellow');
    expect(businessHealth({ ...base, lastStampAt: iso(NOW - 14 * DAY - HOUR) }, NOW)).toBe('red');
  });
  it('nunca selló: cuenta desde que terminó el asistente', () => {
    expect(businessHealth({ ...base, setupCompletedAt: iso(NOW - 3 * DAY) }, NOW)).toBe('green');
    expect(businessHealth({ ...base }, NOW)).toBe('red');
  });
  it('configurando y suspendidos no aplican; sin estado = activo', () => {
    expect(businessHealth({ ...base, status: 'setup' }, NOW)).toBe('none');
    expect(businessHealth({ ...base, status: 'suspended', lastStampAt: iso(NOW - DAY) }, NOW)).toBe('none');
    expect(businessHealth({ createdAt: iso(NOW - 50 * DAY), lastStampAt: iso(NOW - DAY) }, NOW)).toBe('green');
  });
});

describe('Hoy te toca', () => {
  it('arma cada tipo de tarea y no molesta con lo que está bien', () => {
    const rows = [
      row('due', { planExpiresAt: iso(NOW + 3 * DAY) }, { lastStampAt: iso(NOW - DAY) }),
      row('expired', { planExpiresAt: iso(NOW - 2 * DAY) }, { lastStampAt: iso(NOW - DAY) }),
      row('susp', { status: 'suspended', planExpiresAt: iso(NOW - 40 * DAY) }),
      row('idle10', {}, { lastStampAt: iso(NOW - 10 * DAY) }),
      row('idle20', {}, { lastStampAt: iso(NOW - 20 * DAY) }),
      row('ok', { planExpiresAt: iso(NOW + 40 * DAY) }, { lastStampAt: iso(NOW - HOUR) }),
      row('inv', { status: 'setup', createdAt: iso(NOW - 5 * DAY), setupCompletedAt: undefined }, { invitePending: true, inviteExpiresAt: iso(NOW - 2 * DAY) }),
      row('invok', { status: 'setup', createdAt: iso(NOW - DAY), setupCompletedAt: undefined }, { invitePending: true, inviteExpiresAt: iso(NOW + 2 * DAY) }),
      row('stuck', { status: 'setup', createdAt: iso(NOW - 5 * DAY), setupCompletedAt: undefined }),
      row('fresh', { status: 'setup', createdAt: iso(NOW - DAY), setupCompletedAt: undefined })
    ];
    const tasks = buildAdminTasks(rows, NOW);
    const by = (id: string) => tasks.filter((t) => t.businessId === id).map((t) => t.kind);
    expect(by('due')).toEqual(['payment_due']);
    expect(by('expired')).toEqual(['plan_expired']);
    expect(by('susp')).toEqual([]);
    expect(by('idle10')).toEqual(['inactive']);
    expect(by('idle20')).toEqual(['inactive']);
    expect(by('ok')).toEqual([]);
    expect(by('inv')).toEqual(['invite_expired']);
    expect(by('invok')).toEqual([]);
    expect(by('stuck')).toEqual(['setup_stuck']);
    expect(by('fresh')).toEqual([]);

    const due = tasks.find((t) => t.kind === 'payment_due')!;
    expect(due).toMatchObject({ label: 'Vence en 3 días', severity: 'warning', amountCents: 5499, days: 3, id: 'payment_due:due' });
    expect(due.reason).toContain('Cobra $54,99');
    expect(tasks.find((t) => t.businessId === 'idle20')!.severity).toBe('critical');
    expect(tasks.find((t) => t.businessId === 'idle10')!.severity).toBe('warning');
    expect(tasks.find((t) => t.kind === 'plan_expired')!.reason).toContain('hace 2 días');
    // critical primero, info al final
    expect(tasks[0].severity).toBe('critical');
    expect(tasks[tasks.length - 1].kind).toBe('setup_stuck');
  });
});

describe('dinero', () => {
  const rows = [
    row('a', { plan: 'pro', planExpiresAt: iso(NOW + 10 * DAY) }),
    row('b', { plan: 'basico' }),                                                            // sin vencimiento
    row('c', { plan: 'standard', planExpiresAt: iso(NOW - 3 * DAY) }),                       // activo vencido
    row('d', { plan: 'standard', status: 'suspended', planExpiresAt: iso(NOW - 30 * DAY) }), // suspendido vencido
    row('e', { plan: 'pro', status: 'suspended', planExpiresAt: iso(NOW + 5 * DAY) }),       // suspendido al día
    row('f', { plan: 'basico', status: 'setup', planExpiresAt: iso(NOW + 20 * DAY) }),       // configurando
    row('g', { plan: 'standard', planExpiresAt: iso(NOW + 45 * DAY) })
  ];
  it('MRR solo con activos al día; renovaciones 30 días sin suspendidos; en riesgo = activos o suspendidos vencidos', () => {
    const m = buildMoney(rows, NOW);
    expect(m.mrrCents).toBe(7999 + 2999 + 5499);
    expect(m.payingCount).toBe(3);
    expect(m.byPlan).toEqual([
      { plan: 'basico', label: 'Básico', count: 1, mrrCents: 2999 },
      { plan: 'standard', label: 'Standard', count: 1, mrrCents: 5499 },
      { plan: 'pro', label: 'Pro', count: 1, mrrCents: 7999 }
    ]);
    expect(m.upcomingRenewals.items.map((x) => x.businessId)).toEqual(['a', 'f']);
    expect(m.upcomingRenewals.totalCents).toBe(7999 + 2999);
    expect(m.atRisk.items.map((x) => x.businessId)).toEqual(['d', 'c']);
    expect(m.atRisk.totalCents).toBe(5499 * 2);
    expect(m.atRisk.items[1]).toMatchObject({ days: -3, status: 'active', plan: 'standard' });
  });

  it('cobrado por mes según el día del pago', () => {
    const r = collectedByMonth([
      { amountCents: 5499, paidAt: '2026-11-02' }, { amountCents: 2999, paidAt: '2026-11-20' },
      { amountCents: 7999, paidAt: '2026-10-31' }, { amountCents: 100, paidAt: '2025-01-01' }
    ], NOW, 6);
    expect(r.thisMonthCents).toBe(8498);
    expect(r.series.map((p) => p.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.series.slice(-2).map((p) => p.value)).toEqual([7999, 8498]);
  });

  it('formatCents', () => {
    expect(formatCents(5499)).toBe('$54,99');
    expect(formatCents(1234567)).toBe('$12.345,67');
  });
});

describe('ranking', () => {
  it('top y bottom de activos por sellos en 30 días, sin repetir', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`b${i}`, {}, { stamps30d: i * 10, lastStampAt: iso(NOW - DAY) }));
    rows.push(row('s', { status: 'suspended' }, { stamps30d: 999 }));
    const health = buildHealth(rows, NOW);
    const r = rankBusinesses(health.businesses, 5);
    expect(r.top.map((x) => x.businessId)).toEqual(['b7', 'b6', 'b5', 'b4', 'b3']);
    expect(r.bottom.map((x) => x.businessId)).toEqual(['b0', 'b1', 'b2']);
    expect(health.counts).toEqual({ green: 8, yellow: 0, red: 0, none: 1 });
  });
});

describe('pagos: nuevo vencimiento', () => {
  it('desde el vencimiento actual si todavía no llega', () => {
    const r = nextPlanExpiry({ currentExpiresAt: ecEndOfDayIso('2026-12-10'), paidAt: '2026-11-25', months: 1 });
    expect(r).toEqual({ expiresAt: ecEndOfDayIso('2027-01-10'), months: 1 });
  });
  it('desde el día del pago si ya venció o no tenía', () => {
    expect(nextPlanExpiry({ currentExpiresAt: ecEndOfDayIso('2026-11-01'), paidAt: '2026-11-25', months: 3 }).expiresAt).toBe(ecEndOfDayIso('2027-02-25'));
    expect(nextPlanExpiry({ paidAt: '2026-01-31' }).expiresAt).toBe(ecEndOfDayIso('2026-02-28'));
  });
  it('fecha a mano', () => {
    expect(nextPlanExpiry({ currentExpiresAt: ecEndOfDayIso('2026-12-10'), paidAt: '2026-11-25', newExpiresAt: '2027-06-30' }))
      .toEqual({ expiresAt: ecEndOfDayIso('2027-06-30'), months: null });
  });
  it('valida monto, fecha, método, meses y nota', () => {
    const ok = { amountCents: 5499, paidAt: '2026-11-25', method: 'transferencia' as const };
    expect(validatePayment(ok, NOW)).toBeNull();
    expect(validatePayment({ ...ok, amountCents: 0 }, NOW)?.field).toBe('amount');
    expect(validatePayment({ ...ok, paidAt: '2026-11-26' }, NOW)?.error).toBe('La fecha del pago no puede ser futura.');
    expect(validatePayment({ ...ok, paidAt: '2026-02-30' }, NOW)?.field).toBe('paidAt');
    expect(validatePayment({ ...ok, method: 'bitcoin' as never }, NOW)?.field).toBe('method');
    expect(validatePayment({ ...ok, months: 0 }, NOW)?.field).toBe('months');
    expect(validatePayment({ ...ok, months: 25 }, NOW)?.field).toBe('months');
    expect(validatePayment({ ...ok, newExpiresAt: '2026-11-20' }, NOW)?.field).toBe('newExpiresAt');
    expect(validatePayment({ ...ok, newExpiresAt: '2027-01-01', months: 2 }, NOW)?.field).toBe('months');
    expect(validatePayment({ ...ok, note: 'x'.repeat(501) }, NOW)?.field).toBe('note');
  });
});

describe('costo de IA', () => {
  it('tokens con caché y fotos', () => {
    // 1M de entrada (400k en caché), 1M de salida y 10 fotos
    expect(aiCostUsd({ promptTokens: 1_000_000, cachedTokens: 400_000, completionTokens: 1_000_000, images: 10 }))
      .toBeCloseTo(0.6 * 0.28 + 0.4 * 0.028 + 0.42 + 0.35, 4);
    const r = aiCostRow({ id: 'x', name: 'X', plan: 'basico', status: 'active' }, { texts: 10, images: 5, promptTokens: 7000, cachedTokens: 3000, completionTokens: 8000 });
    expect(r.costUsd).toBeCloseTo(0.1795, 3);
    expect(r.planPriceUsd).toBe(29.99);
    expect(r.ratio).toBeCloseTo(0.006, 3);
    expect(aiCostRow({ id: 'y', name: 'Y', plan: 'pro' }, undefined)).toMatchObject({ costUsd: 0, ratio: 0, texts: 0 });
  });
});

describe('historial', () => {
  it('frases en español', () => {
    expect(adminActionSummary('plan_changed', { from: 'basico', to: 'pro' })).toBe('Cambió el plan de Básico a Pro.');
    expect(adminActionSummary('payment_recorded', { amountCents: 5499, months: 1, method: 'transferencia', newExpiresAt: ecEndOfDayIso('2026-12-25') }))
      .toBe('Registró $54,99 (transferencia) por 1 mes; vence el 25 dic 2026.');
    expect(adminActionSummary('expiry_changed', { autoRenew: true })).toBe('Activó la renovación mensual.');
    expect(adminActionSummary('phone_changed', { to: '+593991234567' })).toBe('Guardó el celular +593991234567.');
    expect(adminActionSummary('phone_changed', { to: null })).toBe('Borró el celular del dueño.');
    expect(adminActionSummary('access_resent', { kind: 'invite', email: 'a@b.ec' })).toBe('Reenvió la invitación a a@b.ec.');
  });
});

describe('buildAdminInsights', () => {
  it('series con el largo pedido y todo armado', () => {
    const ins = buildAdminInsights({
      now: NOW,
      rows: [row('a', { planExpiresAt: iso(NOW + 2 * DAY) }, { lastStampAt: iso(NOW - HOUR), stamps30d: 40 })],
      counts: { businessesByMonth: { '2026-11': 1 }, customersByWeek: {}, stampsByDay: { '2026-11-25': 7 }, redemptionsByDay: {} },
      payments: [{ amountCents: 5499, paidAt: '2026-11-03' }],
      aiUsage: { a: { texts: 3, images: 1, promptTokens: 1500, cachedTokens: 900, completionTokens: 2000 } }
    });
    expect(ins.series.businessesByMonth).toHaveLength(12);
    expect(ins.series.customersByWeek).toHaveLength(12);
    expect(ins.series.stampsByDay).toHaveLength(90);
    expect(ins.series.redemptionsByDay).toHaveLength(90);
    expect(ins.series.stampsByDay[89].value).toBe(7);
    expect(ins.money.collectedThisMonthCents).toBe(5499);
    expect(ins.money.collectedByMonth).toHaveLength(6);
    expect(ins.tasks.map((t) => t.kind)).toEqual(['payment_due']);
    expect(ins.ranking.top[0].businessId).toBe('a');
    expect(ins.ai.businesses).toHaveLength(1);
    expect(ins.ai.since).toBe('2026-11-01T05:00:00.000Z');
  });
});

describe('parseAmountCents', () => {
  it('entiende coma o punto decimal y separador de miles', () => {
    expect(parseAmountCents('54,99')).toBe(5499);
    expect(parseAmountCents('54.99')).toBe(5499);
    expect(parseAmountCents('$ 54')).toBe(5400);
    expect(parseAmountCents('54,9')).toBe(5490);
    expect(parseAmountCents('1.319,76')).toBe(131976);
    expect(parseAmountCents('1,319.76')).toBe(131976);
    expect(parseAmountCents('1.000')).toBe(100000);
    expect(parseAmountCents('12.345.678,90')).toBe(1234567890);
  });
  it('rechaza lo que no es un monto (0)', () => {
    for (const bad of ['', 'abc', '54,99abc', '-5', '0', '0,00', '1.2.3', '1.234.56', '54,', '1,0000', '12,34,56', '1e3']) {
      expect(parseAmountCents(bad), bad).toBe(0);
    }
  });
});
