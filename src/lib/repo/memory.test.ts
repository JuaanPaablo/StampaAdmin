import { describe, expect, it } from 'vitest';
import { DEMO_BUSINESS_ID } from '../contracts';
import { codeStatus } from '../domain';
import { DEMO_PINS, SEED_BUSINESS_IDS, buildSeed } from '../seed';
import { createMemoryRepo } from './memory';

const ID = DEMO_BUSINESS_ID;

describe('humo: crear código, reclamar y alertas', () => {
  it('3 clientes reclaman un código de 3 cupos; el 4.º se rechaza y aparecen las alertas', async () => {
    const repo = createMemoryRepo();
    const staff = await repo.listStaff(ID);
    const marco = staff.find((s) => s.name === 'Marco')!;
    const clients = (await repo.listCustomers(ID, { segment: 'activo' })).filter((c) => c.stamps < 5).slice(0, 4);
    expect(clients).toHaveLength(4);

    const made = await repo.createStampCode(ID, { staffId: marco.id, ticket: 'HUMO-1', amountCents: 800, seats: 3 });
    if (!made.ok) throw new Error(made.error);
    const { code } = made.code ? { code: made.code } : (null as never);

    for (const c of clients.slice(0, 3)) {
      const r = await repo.claimStampCode(ID, code.code, c.id);
      expect(r.ok).toBe(true);
    }
    const fourth = await repo.claimStampCode(ID, code.code, clients[3].id);
    expect(fourth).toEqual({ ok: false, error: 'Este código ya se agotó: todos los cupos fueron usados.' });
    await repo.claimStampCode(ID, code.code, clients[3].id);

    const stored = (await repo.getStampCode(ID, code.id))!;
    expect(stored.claims).toHaveLength(3);
    expect(stored.attempts).toBe(2);
    expect(codeStatus(stored)).toBe('agotado');

    // mismo ticket otra vez: se rechaza y queda registrado
    const dup = await repo.createStampCode(ID, { staffId: marco.id, ticket: ' humo-1 ', amountCents: 800, seats: 1 });
    expect(dup).toMatchObject({ ok: false, field: 'ticket' });

    const alerts = await repo.listAlerts(ID, 200);
    expect(alerts.some((a) => a.kind === 'shared_code' && a.codeId === code.id && a.message.includes(code.code))).toBe(true);
    expect(alerts.some((a) => a.kind === 'duplicate_ticket' && a.message.includes('HUMO-1'.toLowerCase()) === false && a.staffId === marco.id)).toBe(true);
    expect(alerts.some((a) => a.kind === 'staff_ratio' && a.message.includes('Pedro'))).toBe(true);
    const times = alerts.map((a) => Date.parse(a.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe('reglas dentro del repo', () => {
  it('cupos, aprobación con PIN, anulaciones y canje', async () => {
    const repo = createMemoryRepo();
    const staff = await repo.listStaff(ID);
    const lucia = staff.find((s) => s.name === 'Lucía')!;
    const owner = staff.find((s) => s.role === 'owner')!;
    const base = { staffId: lucia.id, amountCents: 5000, seats: 6 };

    expect(await repo.createStampCode(ID, { ...base, ticket: 'R-1', amountCents: 400, seats: 5 })).toMatchObject({ ok: false, field: 'seats' });
    expect(await repo.createStampCode(ID, { ...base, ticket: 'R-2' })).toMatchObject({ ok: false, field: 'pin' });
    expect(await repo.createStampCode(ID, { ...base, ticket: 'R-2', approvalPin: '9999' })).toMatchObject({ ok: false, field: 'pin' });
    expect(await repo.createStampCode(ID, { ...base, ticket: 'R-2', approvalPin: DEMO_PINS.cashier })).toMatchObject({ ok: false, field: 'pin' });
    const ok = await repo.createStampCode(ID, { ...base, ticket: 'R-2', approvalPin: DEMO_PINS.manager });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.code.approvedBy).toBeTruthy();
    expect(ok.code.expiresAt > ok.code.createdAt).toBe(true);

    // un cliente, un cupo; anular no devuelve el cupo
    const [a] = (await repo.listCustomers(ID, { segment: 'activo' })).filter((c) => c.stamps > 0 && c.stamps < 8);
    const r1 = await repo.claimStampCode(ID, ok.code.code, a.id);
    expect(r1.ok).toBe(true);
    expect(await repo.claimStampCode(ID, ok.code.code, a.id)).toEqual({ ok: false, error: 'Ya reclamaste un sello con este código.' });
    const before = (await repo.getCustomerDetail(ID, a.id))!.customer;
    const claimId = (await repo.getStampCode(ID, ok.code.id))!.claims[0].id;
    await repo.voidClaim(ID, ok.code.id, claimId, owner.id);
    const after = (await repo.getCustomerDetail(ID, a.id))!;
    expect(after.customer.stamps).toBe(before.stamps - 1);
    const reread = (await repo.getStampCode(ID, ok.code.id))!;
    expect(reread.claims).toHaveLength(1);
    expect(reread.claims[0].voidedAt).toBeTruthy();
    expect(after.history.some((h) => h.kind === 'void')).toBe(true);
    expect((await repo.listAudit(ID, 5)).map((x) => x.action)).toContain('claim.void');

    // canje: exige tarjeta completa
    await expect(repo.redeemReward(ID, a.id, owner.id)).rejects.toThrow(/Aún no completa/);
    const [ready] = await repo.listRedeemable(ID);
    const prog = await repo.getProgram(ID);
    const red = await repo.redeemReward(ID, ready.id, owner.id);
    expect(red.customerId).toBe(ready.id);
    const now = (await repo.getCustomerDetail(ID, ready.id))!.customer;
    expect(now.stamps).toBe(ready.stamps - prog.stampsRequired);
    expect(now.rewardsRedeemed).toBe(ready.rewardsRedeemed + 1);
  });

  it('tarjeta completa, código inexistente, cancelado y vencido', async () => {
    let t = Date.now();
    const repo = createMemoryRepo({ clock: () => t });
    const staff = await repo.listStaff(ID);
    const marco = staff.find((s) => s.name === 'Marco')!;
    const [full] = await repo.listRedeemable(ID);
    const [other, other2] = (await repo.listCustomers(ID, { segment: 'activo' })).filter((c) => c.stamps < 5);

    expect(await repo.claimStampCode(ID, '000000', other.id)).toMatchObject({ ok: false, error: expect.stringContaining('no existe') });
    const made = await repo.createStampCode(ID, { staffId: marco.id, ticket: 'E-1', amountCents: 1000, seats: 3 });
    if (!made.ok) throw new Error(made.error);
    expect(await repo.claimStampCode(ID, made.code.code, full.id)).toMatchObject({ ok: false, error: expect.stringContaining('completa') });
    await repo.cancelStampCode(ID, made.code.id, marco.id);
    expect(await repo.claimStampCode(ID, made.code.code, other.id)).toMatchObject({ ok: false, error: expect.stringContaining('cancelado') });

    const made2 = await repo.createStampCode(ID, { staffId: marco.id, ticket: 'E-2', amountCents: 1000, seats: 3 });
    if (!made2.ok) throw new Error(made2.error);
    t += 6 * 60_000;
    expect(await repo.claimStampCode(ID, made2.code.code, other2.id)).toMatchObject({ ok: false, error: expect.stringContaining('venció') });
  });

  it('cooldown del programa (gimnasio)', async () => {
    const repo = createMemoryRepo();
    const gym = 'biz_pulso';
    const staff = (await repo.listStaff(gym)).find((s) => s.role === 'cashier')!;
    const c = (await repo.listCustomers(gym, { segment: 'activo' })).find((x) => x.stamps < 5)!;
    const a = await repo.createStampCode(gym, { staffId: staff.id, ticket: 'G-1', amountCents: 0, seats: 1 });
    const b = await repo.createStampCode(gym, { staffId: staff.id, ticket: 'G-2', amountCents: 0, seats: 1 });
    if (!a.ok || !b.ok) throw new Error('no se pudo crear');
    expect((await repo.claimStampCode(gym, a.code.code, c.id)).ok).toBe(true);
    const second = await repo.claimStampCode(gym, b.code.code, c.id);
    expect(second).toMatchObject({ ok: false, error: expect.stringContaining('espera') });
  });

  it('crea negocio con plantilla, sucursal Principal y dueño con PIN; valida contacto', async () => {
    const repo = createMemoryRepo({ seed: false });
    const { business, ownerId } = await repo.createBusiness({ name: 'Spa Brisa', type: 'spa', city: 'Manta', ownerName: 'Rosa Mero', ownerPin: '4321' });
    expect(business.slug).toBe('spa-brisa');
    const again = await repo.createBusiness({ name: 'Spa Brisa', type: 'spa', ownerName: 'Otra', ownerPin: '1111' });
    expect(again.business.slug).toBe('spa-brisa-2');
    expect((await repo.getProgram(business.id)).rewardTitle).toBe('Masaje de 30 min');
    expect((await repo.listLocations(business.id)).map((l) => l.name)).toEqual(['Principal']);
    expect(await repo.verifyStaffPin(business.id, ownerId, '4321')).toBe(true);
    expect(await repo.verifyStaffPin(business.id, ownerId, '0000')).toBe(false);
    const staff = await repo.listStaff(business.id);
    expect(staff[0]).toMatchObject({ role: 'owner', hasPin: true });
    expect(JSON.stringify(staff)).not.toContain('pinHash');

    await expect(repo.registerCustomer(business.id, { name: 'Ana', contact: '123', contactKind: 'whatsapp' })).rejects.toThrow(/WhatsApp/);
    await expect(repo.registerCustomer(business.id, { name: 'Ana', contact: 'ana@', contactKind: 'email' })).rejects.toThrow(/correo/);
    const c = await repo.registerCustomer(business.id, { name: 'Ana Mora', contact: '099 123 4567', contactKind: 'whatsapp' });
    expect(c.contact).toBe('0991234567');
    await expect(repo.registerCustomer(business.id, { name: 'Ana Mora', contact: '0991234567', contactKind: 'whatsapp' })).rejects.toThrow(/Ya existe/);
  });
});

describe('datos de ejemplo', () => {
  it('es determinista (misma estructura con el mismo instante)', () => {
    const now = Date.now();
    expect(buildSeed(now)).toEqual(buildSeed(now));
  });

  it('cinco negocios con las reglas pedidas', async () => {
    const repo = createMemoryRepo();
    const list = await repo.listBusinesses();
    expect(list.map((b) => b.id)).toEqual([...SEED_BUSINESS_IDS]);
    expect(list.map((b) => b.type)).toEqual(['cafeteria', 'gimnasio', 'floristeria', 'restaurante', 'barberia']);
    expect((await repo.getProgram('biz_pulso')).requireAmount).toBe(false);
    expect((await repo.listLocations(ID)).length).toBe(2);
    for (const b of list) {
      const staff = await repo.listStaff(b.id);
      expect(staff.length).toBeGreaterThanOrEqual(3);
      expect(staff.length).toBeLessThanOrEqual(5);
      const owner = staff.find((s) => s.role === 'owner')!, manager = staff.find((s) => s.role === 'manager')!, cashier = staff.find((s) => s.role === 'cashier')!;
      expect(await repo.verifyStaffPin(b.id, owner.id, DEMO_PINS.owner)).toBe(true);
      expect(await repo.verifyStaffPin(b.id, manager.id, DEMO_PINS.manager)).toBe(true);
      expect(await repo.verifyStaffPin(b.id, cashier.id, DEMO_PINS.cashier)).toBe(true);

      const customers = await repo.listCustomers(b.id);
      expect(customers.length).toBeGreaterThanOrEqual(35);
      expect(customers.length).toBeLessThanOrEqual(70);
      const seg = (s: string) => customers.filter((c) => c.segment === s).length;
      for (const s of ['nuevo', 'activo', 'en_riesgo', 'inactivo']) expect(seg(s), `${b.id} ${s}`).toBeGreaterThan(2);
      expect(seg('por_canjear')).toBeGreaterThanOrEqual(2);
      expect(seg('por_canjear')).toBeLessThanOrEqual(3);
      expect(customers.filter((c) => c.birthday).length).toBeGreaterThan(20);

      const dash = await repo.getDashboard(b.id, '90d');
      expect(dash.upcomingBirthdays.length).toBeGreaterThan(2);
      expect(dash.series).toHaveLength(90);
      expect(dash.kpis.stampsIssued).toBeGreaterThan(150);
      expect((await repo.listRedemptions(b.id)).length).toBeGreaterThan(0);
      const codes = await repo.listStampCodes(b.id, 5000);
      expect(codes.some((c) => c.attempts > 0)).toBe(true);
      expect(codes.some((c) => c.claims.some((cl) => cl.voidedAt))).toBe(true);
      const alerts = await repo.listAlerts(b.id, 100);
      for (const kind of ['shared_code', 'approval', 'voids', 'duplicate_ticket']) expect(alerts.some((a) => a.kind === kind), `${b.id} ${kind}`).toBe(true);
    }
  });

  it('los contadores de cada cliente cuadran con los reclamos y canjes', async () => {
    const repo = createMemoryRepo();
    for (const b of await repo.listBusinesses()) {
      const prog = await repo.getProgram(b.id);
      const codes = await repo.listStampCodes(b.id, 10000);
      const reds = await repo.listRedemptions(b.id, 10000);
      for (const c of await repo.listCustomers(b.id)) {
        const valid = codes.flatMap((x) => x.claims).filter((cl) => cl.customerId === c.id && !cl.voidedAt).length;
        const redeemed = reds.filter((r) => r.customerId === c.id).length;
        expect(c.totalStamps, c.id).toBe(valid);
        expect(c.rewardsRedeemed, c.id).toBe(redeemed);
        expect(c.stamps, c.id).toBe(valid - redeemed * prog.stampsRequired);
      }
      // ticket y código únicos por negocio
      expect(new Set(codes.map((c) => c.ticket)).size).toBe(codes.length);
      for (const c of codes) expect(c.claims.length).toBeLessThanOrEqual(c.seats);
    }
  });

  it('negocio demo: Pedro con 9 tickets y 22 sellos, marcado; Marco y Lucía normales', async () => {
    const repo = createMemoryRepo();
    for (const range of ['30d', '90d'] as const) {
      const rep = await repo.getStaffReport(ID, range);
      const pedro = rep.find((r) => r.name === 'Pedro')!;
      expect(pedro).toMatchObject({ tickets: 9, stamps: 22, flagged: true });
      for (const n of ['Marco', 'Lucía']) {
        const r = rep.find((x) => x.name === n)!;
        expect(r.flagged).toBe(false);
        expect(r.ratio).toBeLessThan(1.8);
        expect(r.tickets).toBeGreaterThan(20);
      }
    }
    const w = (await repo.getStaffReport(ID, '7d')).find((r) => r.name === 'Pedro')!;
    expect(w.tickets).toBeGreaterThanOrEqual(5);
  });

  it('el panel se ve vivo: hay un código activo ahora y ventas recientes', async () => {
    const repo = createMemoryRepo();
    const codes = await repo.listStampCodes(ID, 200);
    expect(codes.some((c) => codeStatus(c) === 'activo')).toBe(true);
    const dash = await repo.getDashboard(ID, '7d');
    expect(dash.kpis.stampsIssued).toBeGreaterThan(20);
    expect(dash.byHour.reduce((a, h) => a + h.stamps, 0)).toBe(dash.kpis.stampsIssued);
    expect(dash.byWeekday).toHaveLength(7);
    // horario: la cafetería pica por la mañana
    const d90 = await repo.getDashboard(ID, '90d');
    const am = d90.byHour.filter((h) => h.hour >= 7 && h.hour <= 10).reduce((a, h) => a + h.stamps, 0);
    expect(am / d90.kpis.stampsIssued).toBeGreaterThan(0.4);
    const gym = await repo.getDashboard('biz_pulso', '90d');
    const peaks = gym.byHour.filter((h) => [6, 17, 18, 19].includes(h.hour)).reduce((a, h) => a + h.stamps, 0);
    expect(peaks / gym.kpis.stampsIssued).toBeGreaterThan(0.5);
  });

  it('listCustomers: búsqueda sin tildes, segmento y orden', async () => {
    const repo = createMemoryRepo();
    const all = await repo.listCustomers(ID);
    const target = all.find((c) => /[áéíóúñ]/i.test(c.name))!;
    const folded = target.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    expect((await repo.listCustomers(ID, { search: folded })).some((c) => c.id === target.id)).toBe(true);
    const risk = await repo.listCustomers(ID, { segment: 'en_riesgo' });
    expect(risk.every((c) => c.segment === 'en_riesgo')).toBe(true);
    const byStamps = await repo.listCustomers(ID, { sort: 'sellos' });
    expect(byStamps[0].stamps).toBeGreaterThanOrEqual(byStamps[byStamps.length - 1].stamps);
    const byName = await repo.listCustomers(ID, { sort: 'nombre' });
    expect(byName.map((c) => c.name)).toEqual([...byName.map((c) => c.name)].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
