import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { ecEndOfDayIso, ecDayKey } from '../domain/admin-insights';
import { PHONE_ERROR } from '../phone';
import { SEED_BUSINESS_IDS } from '../seed';

/** Panel de administrador (0009) contra el repo en memoria: la referencia que supabase.ts imita. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PASSWORD = 'Contrasena-Segura-2026';

function setup() {
  let now = Date.UTC(2026, 10, 25, 15, 0, 0);   // miércoles 25 nov 2026, 10:00 en Ecuador
  const repo = createMemoryRepo({ seed: false, clock: () => now });
  return { repo, now: () => now, advance: (ms: number) => { now += ms; } };
}

async function activeBusiness(repo: ReturnType<typeof setup>['repo'], email: string, name: string, planExpiresAt?: string) {
  const { business, ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: email, plan: 'standard', planExpiresAt });
  await repo.consumeAccessToken(invite.token, PASSWORD, 'Dueña Prueba');
  await repo.saveBusinessSetup(business.id, { name, type: 'cafeteria', city: 'Quito' }, ownerId);
  await repo.upsertLocation(business.id, { name: 'Principal', address: 'Av. Amazonas' });
  return { business: await repo.completeBusinessSetup(business.id, ownerId), ownerId };
}

describe('recordPayment', () => {
  it('extiende desde el vencimiento actual si aún no llega, y registra la acción', async () => {
    const { repo } = setup();
    const admin = await repo.upsertAdmin('admin@stampa.ec', PASSWORD);
    const { business } = await activeBusiness(repo, 'a@cafe.ec', 'Café Uno', ecEndOfDayIso('2026-12-10'));
    const { payment, business: after } = await repo.recordPayment({
      businessId: business.id, amountCents: 5499, paidAt: '2026-11-24', method: 'transferencia', months: 1, note: ' Banco Pichincha ', createdBy: admin.id
    });
    expect(after.planExpiresAt).toBe(ecEndOfDayIso('2027-01-10'));
    expect(payment).toMatchObject({
      businessId: business.id, amountCents: 5499, paidAt: '2026-11-24', plan: 'standard', months: 1, method: 'transferencia',
      note: 'Banco Pichincha', previousExpiresAt: ecEndOfDayIso('2026-12-10'), newExpiresAt: ecEndOfDayIso('2027-01-10'), createdBy: admin.id
    });
    expect((await repo.getBusiness(business.id))!.planExpiresAt).toBe(ecEndOfDayIso('2027-01-10'));
    const actions = await repo.listAdminActions(business.id);
    expect(actions[0]).toMatchObject({ kind: 'payment_recorded', adminId: admin.id, adminEmail: 'admin@stampa.ec' });
    expect(actions[0].summary).toBe('Registró $54,99 (transferencia) por 1 mes; vence el 10 ene 2027.');
    expect(await repo.listPayments(business.id)).toHaveLength(1);
  });

  it('si ya venció, cuenta desde el día del pago; no reactiva a un suspendido; fecha a mano', async () => {
    const { repo } = setup();
    const { business } = await activeBusiness(repo, 'b@cafe.ec', 'Café Dos', ecEndOfDayIso('2026-12-01'));
    await repo.updateBusinessPlan(business.id, 'standard', ecEndOfDayIso('2026-10-31'));
    await repo.setBusinessStatus(business.id, 'suspended');
    const r = await repo.recordPayment({ businessId: business.id, amountCents: 16497, paidAt: '2026-11-25', method: 'efectivo', months: 3 });
    expect(r.business.planExpiresAt).toBe(ecEndOfDayIso('2027-02-25'));
    expect(r.business.status).toBe('suspended');
    const manual = await repo.recordPayment({ businessId: business.id, amountCents: 5499, paidAt: '2026-11-25', method: 'otro', newExpiresAt: '2027-06-30' });
    expect(manual.payment.months).toBeNull();
    expect(manual.business.planExpiresAt).toBe(ecEndOfDayIso('2027-06-30'));
    // el más reciente primero (mismo día: el último registrado primero)
    expect((await repo.listPayments(business.id)).map((p) => p.id)).toEqual([manual.payment.id, r.payment.id]);
  });

  it('valida en español y no toca nada si falla', async () => {
    const { repo } = setup();
    const { business } = await activeBusiness(repo, 'c@cafe.ec', 'Café Tres', ecEndOfDayIso('2026-12-01'));
    const ok = { businessId: business.id, amountCents: 5499, paidAt: '2026-11-25', method: 'transferencia' as const };
    await expect(repo.recordPayment({ ...ok, amountCents: 0 })).rejects.toThrow('Escribe el monto pagado.');
    await expect(repo.recordPayment({ ...ok, paidAt: '2026-11-26' })).rejects.toThrow('La fecha del pago no puede ser futura.');
    await expect(repo.recordPayment({ ...ok, months: 30 })).rejects.toThrow('Elige entre 1 y 24 meses.');
    await expect(repo.recordPayment({ ...ok, businessId: 'biz_nada' })).rejects.toThrow('No encontramos ese negocio.');
    expect(await repo.listPayments(business.id)).toHaveLength(0);
    expect((await repo.getBusiness(business.id))!.planExpiresAt).toBe(ecEndOfDayIso('2026-12-01'));
  });
});

describe('historial de acciones', () => {
  it('guarda, ordena y arma la frase', async () => {
    const { repo, advance } = setup();
    const { business } = await activeBusiness(repo, 'd@cafe.ec', 'Café Cuatro');
    await repo.logAdminAction({ businessId: business.id, kind: 'suspended' });
    advance(60_000);
    await repo.logAdminAction({ businessId: business.id, kind: 'plan_changed', detail: { from: 'standard', to: 'pro' } });
    const list = await repo.listAdminActions(business.id);
    expect(list.map((a) => a.kind)).toEqual(['plan_changed', 'suspended']);
    expect(list[0].summary).toBe('Cambió el plan de Standard a Pro.');
    expect(list[0].adminId).toBeUndefined();
    expect(await repo.listAdminActions(business.id, 1)).toHaveLength(1);
    await expect(repo.logAdminAction({ businessId: 'biz_nada', kind: 'suspended' })).rejects.toThrow('No encontramos ese negocio.');
  });
});

describe('celular del dueño', () => {
  it('normaliza, valida, borra y aparece en la fila del admin', async () => {
    const { repo } = setup();
    const { business } = await activeBusiness(repo, 'e@cafe.ec', 'Café Cinco');
    expect(await repo.setOwnerPhone(business.id, '099 123 4567')).toBe('+593991234567');
    expect((await repo.getAdminBusiness(business.id))!.ownerPhone).toBe('+593991234567');
    await expect(repo.setOwnerPhone(business.id, '04 234 5678')).rejects.toThrow(PHONE_ERROR);
    expect((await repo.getAdminBusiness(business.id))!.ownerPhone).toBe('+593991234567');
    expect(await repo.setOwnerPhone(business.id, null)).toBeNull();
    expect((await repo.getAdminBusiness(business.id))!.ownerPhone).toBeUndefined();
  });
});

describe('getAdminInsights (repo vacío)', () => {
  it('detecta invitación vencida, atascado en el asistente, inactivo, por vencer y vencido', async () => {
    const { repo, advance, now } = setup();
    const invited = await repo.createBusinessAccess({ ownerEmail: 'inv@x.ec', plan: 'basico' });
    const stuck = await repo.createBusinessAccess({ ownerEmail: 'stuck@x.ec', plan: 'pro' });
    await repo.consumeAccessToken(stuck.invite.token, PASSWORD);
    const { business: due } = await activeBusiness(repo, 'due@x.ec', 'Café Por Vencer');
    const { business: expired } = await activeBusiness(repo, 'exp@x.ec', 'Café Vencido');
    advance(4 * DAY);
    await repo.updateBusinessPlan(due.id, 'standard', new Date(now() + 3 * DAY).toISOString());
    await repo.updateBusinessPlan(expired.id, 'standard', new Date(now() - DAY).toISOString());
    advance(5 * DAY);   // 9 días desde el alta sin sellos

    const ins = await repo.getAdminInsights();
    const kinds = (id: string) => ins.tasks.filter((t) => t.businessId === id).map((t) => t.kind).sort();
    expect(kinds(invited.business.id)).toEqual(['invite_expired']);
    expect(kinds(stuck.business.id)).toEqual(['setup_stuck']);
    expect(kinds(expired.id)).toEqual(['inactive', 'plan_expired']);
    // "due" vencía en 3 días cuando quedaban 5 por avanzar: ahora también está vencido
    expect(kinds(due.id)).toEqual(['inactive', 'plan_expired']);
    expect(ins.money.mrrCents).toBe(0);
    expect(ins.money.atRisk.items).toHaveLength(2);
    expect(ins.health.counts).toEqual({ green: 0, yellow: 2, red: 0, none: 2 });
    expect(ins.series.businessesByMonth.at(-1)).toMatchObject({ key: '2026-12', value: 0 });
    expect(ins.series.businessesByMonth.at(-2)).toMatchObject({ key: '2026-11', value: 4 });
  });

  it('cuenta sellos, canjes y clientes en las series del día y la semana', async () => {
    const { repo, now } = setup();
    const { business, ownerId } = await activeBusiness(repo, 'f@cafe.ec', 'Café Seis', new Date(now() + 60 * DAY).toISOString());
    const c = await repo.registerCustomer(business.id, { name: 'Ana Mora', contact: '0991234567', contactKind: 'whatsapp' });
    const code = await repo.createStampCode(business.id, { staffId: ownerId, ticket: 'A-1', amountCents: 500, seats: 1 });
    if (!code.ok) throw new Error(code.error);
    expect((await repo.claimStampCode(business.id, code.code.code, c.id)).ok).toBe(true);
    const ins = await repo.getAdminInsights();
    const today = ecDayKey(now());
    expect(ins.series.stampsByDay.at(-1)).toMatchObject({ key: today, value: 1 });
    expect(ins.series.customersByWeek.at(-1)).toMatchObject({ key: '2026-11-23', value: 1 });
    expect(ins.money).toMatchObject({ mrrCents: 5499, payingCount: 1 });
    expect(ins.health.businesses[0]).toMatchObject({ health: 'green', stamps7d: 1, stamps30d: 1, daysSinceLastStamp: 0 });
  });
});

describe('datos inventados del panel de administrador (platformDemo)', () => {
  const repo = createMemoryRepo({ platformDemo: true });

  it('conserva los 5 negocios de ejemplo y agrega negocios en todos los estados', async () => {
    const list = await repo.listBusinesses();
    for (const id of SEED_BUSINESS_IDS) expect(list.some((b) => b.id === id)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(15);
    const st = (s: string) => list.filter((b) => (b.status ?? 'active') === s).length;
    expect(st('setup')).toBeGreaterThanOrEqual(3);
    expect(st('suspended')).toBeGreaterThanOrEqual(1);
    expect(new Set(list.map((b) => b.plan))).toEqual(new Set(['basico', 'standard', 'pro']));
  });

  it('el resumen se ve vivo: todas las tareas, semáforo completo, dinero, series y IA', async () => {
    const ins = await repo.getAdminInsights();
    const kinds = new Set(ins.tasks.map((t) => t.kind));
    for (const k of ['payment_due', 'plan_expired', 'inactive', 'setup_stuck', 'invite_expired']) expect(kinds.has(k as never), k).toBe(true);
    for (const h of ['green', 'yellow', 'red', 'none'] as const) expect(ins.health.counts[h], h).toBeGreaterThan(0);
    expect(ins.money.mrrCents).toBeGreaterThan(0);
    expect(ins.money.byPlan.every((p) => p.count > 0)).toBe(true);
    expect(ins.money.upcomingRenewals.items.length).toBeGreaterThan(3);
    expect(ins.money.atRisk.items.length).toBeGreaterThanOrEqual(2);
    expect(ins.money.collectedThisMonthCents).toBeGreaterThan(0);
    expect(ins.money.collectedByMonth.filter((p) => p.value > 0).length).toBeGreaterThanOrEqual(5);
    expect(ins.ranking.top).toHaveLength(5);
    expect(ins.ranking.bottom.length).toBeGreaterThan(0);
    expect(ins.series.businessesByMonth.filter((p) => p.value > 0).length).toBeGreaterThanOrEqual(8);
    expect(ins.series.customersByWeek.every((p) => p.value > 0)).toBe(true);
    const days = ins.series.stampsByDay;
    expect(days.filter((p) => p.value > 0).length).toBeGreaterThan(85);
    // crecimiento: los últimos 30 días tienen más sellos que los 30 anteriores... a 90
    const sum = (a: { value: number }[]) => a.reduce((s, p) => s + p.value, 0);
    expect(sum(days.slice(-30))).toBeGreaterThan(sum(days.slice(0, 30)) * 0.8);
    expect(ins.ai.businesses.length).toBeGreaterThan(5);
    expect(ins.ai.totalCostUsd).toBeGreaterThan(0);
    expect(ins.ai.businesses[0].costUsd).toBeGreaterThanOrEqual(ins.ai.businesses[1].costUsd);
    const withPhone = (await repo.listAdminBusinesses()).filter((r) => r.ownerPhone).length;
    expect(withPhone).toBeGreaterThan(12);
  });

  it('los contadores de cada cliente cuadran con los reclamos y canjes', async () => {
    for (const b of (await repo.listBusinesses()).filter((x) => x.id.startsWith('biz_demo_'))) {
      const prog = await repo.getProgram(b.id);
      const codes = await repo.listStampCodes(b.id, 100000);
      const reds = await repo.listRedemptions(b.id, 100000);
      for (const c of await repo.listCustomers(b.id)) {
        const valid = codes.flatMap((x) => x.claims).filter((cl) => cl.customerId === c.id && !cl.voidedAt).length;
        const redeemed = reds.filter((r) => r.customerId === c.id).length;
        expect(c.totalStamps, c.id).toBe(valid);
        expect(c.rewardsRedeemed, c.id).toBe(redeemed);
        expect(c.stamps, c.id).toBe(valid - redeemed * prog.stampsRequired);
        expect(c.stamps).toBeGreaterThanOrEqual(0);
      }
      expect(new Set(codes.map((c) => c.ticket)).size).toBe(codes.length);
    }
  });

  it('detalle de un negocio con todo', async () => {
    const d = (await repo.getAdminBusinessDetail('biz_demo_sabor'))!;
    expect(d.health).toBe('green');
    expect(d.locations).toHaveLength(2);
    expect(d.staff.some((s) => !s.active)).toBe(true);
    expect(d.staff.every((s) => !s.email || s.hasPassword)).toBe(true);
    expect(d.stampsByDay).toHaveLength(90);
    expect(d.stampsByDay.reduce((s, p) => s + p.value, 0)).toBeGreaterThan(300);
    expect(d.payments.length).toBeGreaterThan(2);
    expect(d.payments[0].paidAt >= d.payments[1].paidAt).toBe(true);
    expect(d.actions.length).toBeGreaterThan(2);
    expect(d.ai.images).toBeGreaterThan(0);
    expect(d.alerts.total).toBeGreaterThan(0);
    expect(d.program?.stampsRequired).toBeGreaterThan(0);
    const inv = (await repo.getAdminBusinessDetail('biz_demo_nuevo1'))!;
    expect(inv.health).toBe('none');
    expect(inv.staff[0]).toMatchObject({ role: 'owner', hasPassword: false, invitePending: true });
    expect(await repo.getAdminBusinessDetail('biz_nada')).toBeNull();
  });
});
