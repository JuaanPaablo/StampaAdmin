import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { addMonths, effectiveExpiry, maxLocations } from '../plan-rules';
import { cleanMilestones, lcfirst, nextReward, pendingRewards, validateMilestones } from '../rewards';
import { citiesOf, provinceOfCity, validatePlace } from '../ecuador';
import { parseMilestonesField } from '../../components/card/schema';

/** Sucursales por plan, renovación automática, premios intermedios y textos (notas de noviembre de 2026). */

const PASSWORD = 'Contrasena-Segura-2026';
const MIN = 60_000;

function setup() {
  let now = Date.UTC(2026, 10, 21, 15, 0, 0);
  const repo = createMemoryRepo({ seed: false, clock: () => now });
  return { repo, advance: (ms: number) => { now += ms; } };
}

async function business(repo: ReturnType<typeof setup>['repo'], plan: 'basico' | 'standard' | 'pro', email = 'duena@p.ec') {
  const { business: b, ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: email, plan });
  await repo.consumeAccessToken(invite.token, PASSWORD, 'Dueña');
  await repo.saveBusinessSetup(b.id, { name: 'Pizzería ' + email, type: 'restaurante', province: 'Pichincha', city: 'Quito' }, ownerId);
  return { id: b.id, ownerId };
}

describe('textos con el nombre del premio', () => {
  it('no cambia mayúsculas sostenidas ni siglas', () => {
    expect(lcfirst('LIMONADA')).toBe('LIMONADA');
    expect(lcfirst('BBQ gratis')).toBe('BBQ gratis');
    expect(lcfirst('Café gratis')).toBe('café gratis');
    expect(lcfirst('postre')).toBe('postre');
    expect(lcfirst('A')).toBe('a');
  });
});

describe('sucursales según el plan', () => {
  it('límites 1 / 3 / 10', () => {
    expect([maxLocations('basico'), maxLocations('standard'), maxLocations('pro')]).toEqual([1, 3, 10]);
  });

  it('no deja crear más de las que permite el plan, pero sí editar', async () => {
    const { repo } = setup();
    const { id } = await business(repo, 'standard');
    for (const n of ['A', 'B', 'C']) await repo.upsertLocation(id, { name: n });
    await expect(repo.upsertLocation(id, { name: 'D' })).rejects.toThrow('hasta 3 sucursales');
    const [first] = await repo.listLocations(id);
    expect((await repo.upsertLocation(id, { id: first.id, name: 'A renombrada' })).name).toBe('A renombrada');
  });

  it('eliminar la oculta, libera el cupo y exige dejar al menos una', async () => {
    const { repo } = setup();
    const { id, ownerId } = await business(repo, 'standard');
    const a = await repo.upsertLocation(id, { name: 'Granados' });
    const b = await repo.upsertLocation(id, { name: 'República' });
    const c = await repo.upsertLocation(id, { name: 'Cumbayá' });
    await repo.deleteLocation(id, b.id, ownerId);
    expect((await repo.listLocations(id)).map((l) => l.name)).toEqual(['Granados', 'Cumbayá']);
    await repo.upsertLocation(id, { name: 'Norte' });
    await expect(repo.upsertLocation(id, { id: b.id, name: 'Revivir' })).rejects.toThrow('No encontramos');
    await repo.deleteLocation(id, c.id, ownerId);
    await repo.deleteLocation(id, (await repo.listLocations(id)).find((l) => l.name === 'Norte')!.id, ownerId);
    await expect(repo.deleteLocation(id, a.id, ownerId)).rejects.toThrow('al menos una');
    expect((await repo.listLocations(id)).map((l) => l.name)).toEqual(['Granados']);
  });

  it('el orden es el de creación (no alfabético)', async () => {
    const { repo } = setup();
    const { id } = await business(repo, 'pro');
    for (const n of ['Zeta', 'Alfa', 'Medio']) await repo.upsertLocation(id, { name: n });
    expect((await repo.listLocations(id)).map((l) => l.name)).toEqual(['Zeta', 'Alfa', 'Medio']);
  });
});

describe('renovación automática', () => {
  it('suma meses calendario sin pasarse de fin de mes', () => {
    expect(new Date(addMonths(Date.UTC(2027, 0, 31), 1)).toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(new Date(addMonths(Date.UTC(2027, 0, 31), 2)).toISOString().slice(0, 10)).toBe('2027-03-31');
  });

  it('un plan vencido avanza al próximo mes; sin renovación queda vencido', () => {
    const now = Date.UTC(2026, 11, 20);
    expect(effectiveExpiry('2026-11-15T04:59:59.000Z', true, now)).toBe('2027-01-15T04:59:59.000Z');
    expect(effectiveExpiry('2026-11-15T04:59:59.000Z', false, now)).toBe('2026-11-15T04:59:59.000Z');
    expect(effectiveExpiry('2027-01-01T00:00:00.000Z', true, now)).toBe('2027-01-01T00:00:00.000Z');
  });

  it('el repo guarda la casilla y la fecha avanza sola', async () => {
    const { repo, advance } = setup();
    const { business: b } = await repo.createBusinessAccess({ ownerEmail: 'r@r.ec', plan: 'pro', planExpiresAt: '2026-11-30T04:59:59.000Z', autoRenew: true });
    expect(b.autoRenew).toBe(true);
    advance(15 * 24 * 60 * MIN);
    expect((await repo.getBusiness(b.id))?.planExpiresAt).toBe('2026-12-30T04:59:59.000Z');
    await repo.updateBusinessPlan(b.id, 'pro', '2027-03-01T04:59:59.000Z', undefined, false);
    expect((await repo.getBusiness(b.id))?.autoRenew).toBe(false);
  });

  it('sin fecha no hay renovación', async () => {
    const { repo } = setup();
    const { business: b } = await repo.createBusinessAccess({ ownerEmail: 's@s.ec', plan: 'pro', autoRenew: true });
    expect(b.autoRenew).toBe(false);
  });
});

describe('premios intermedios', () => {
  const program = { stampsRequired: 10, rewardTitle: 'Pizza gratis', milestones: [{ at: 7, title: 'Postre' }, { at: 4, title: 'Bebida' }] };

  it('valida y ordena', () => {
    expect(cleanMilestones(program.milestones, 10).map((m) => m.at)).toEqual([4, 7]);
    expect(validateMilestones([{ at: 10, title: 'X' + 'x' }], 10)).toMatch(/antes del sello 10/);
    expect(validateMilestones([{ at: 3, title: 'Ab' }, { at: 3, title: 'Cd' }], 10)).toMatch(/Ya hay un premio/);
    expect(validateMilestones([{ at: 3, title: ' ' }], 10)).toMatch(/Escribe el premio/);
    expect(parseMilestonesField('[{"at":4,"title":" Bebida "}]', 10)).toEqual({ value: [{ at: 4, title: 'Bebida' }] });
    expect(parseMilestonesField('', 10)).toEqual({ value: [] });
    expect('error' in parseMilestonesField('[{"at":12,"title":"Bebida"}]', 10)).toBe(true);
  });

  it('el próximo premio y los pendientes', () => {
    expect(nextReward(2, program)).toEqual({ at: 4, title: 'Bebida' });
    expect(nextReward(7, program)).toEqual({ at: 10, title: 'Pizza gratis' });
    expect(pendingRewards({ stamps: 8, milestonesClaimed: [4] }, program)).toEqual([{ milestone: 7, title: 'Postre' }]);
    expect(pendingRewards({ stamps: 10, milestonesClaimed: [4, 7] }, program)).toEqual([{ title: 'Pizza gratis' }]);
  });

  it('canje intermedio sin reiniciar la tarjeta; el final la reinicia', async () => {
    const { repo, advance } = setup();
    const { id, ownerId } = await business(repo, 'pro');
    await repo.upsertLocation(id, { name: 'Principal' });
    await repo.completeBusinessSetup(id, ownerId);
    await repo.updateProgram(id, { stampsRequired: 5, rewardTitle: 'Pizza', milestones: [{ at: 2, title: 'Bebida' }], cooldownMinutes: 0, requireAmount: false });
    const c = await repo.registerVerifiedCustomer(id, { name: 'Ana', email: 'ana@a.ec', birthday: { d: 1, m: 1 } });
    const stamp = async (n: number) => {
      const made = await repo.createStampCode(id, { staffId: ownerId, ticket: 'T-' + n, amountCents: 0, seats: 1 });
      if (!made.ok) throw new Error(made.error);
      expect((await repo.claimStampCode(id, made.code.code, c.id)).ok).toBe(true);
      advance(MIN);
    };
    await stamp(1);
    await expect(repo.redeemReward(id, c.id, ownerId, 2)).rejects.toThrow('Aún no llega al sello 2');
    await stamp(2);
    expect((await repo.listRedeemable(id)).map((x) => x.id)).toEqual([c.id]);
    const r = await repo.redeemReward(id, c.id, ownerId, 2);
    expect(r).toMatchObject({ milestone: 2, rewardTitle: 'Bebida' });
    await expect(repo.redeemReward(id, c.id, ownerId, 2)).rejects.toThrow('ya se canjeó');
    expect(await repo.listRedeemable(id)).toEqual([]);
    for (const n of [3, 4, 5]) await stamp(n);
    const fin = await repo.redeemReward(id, c.id, ownerId);
    expect(fin.rewardTitle).toBe('Pizza');
    const after = (await repo.listCustomers(id))[0];
    expect(after.stamps).toBe(0);
    expect(after.milestonesClaimed).toEqual([]);
    expect(after.rewardsRedeemed).toBe(2);
  });
});

describe('provincia y ciudad', () => {
  it('24 provincias, la capital primero y validación', () => {
    expect(citiesOf('Pichincha')[0]).toBe('Quito');
    expect(citiesOf('Guayas')[0]).toBe('Guayaquil');
    expect(validatePlace('Pichincha', 'Quito')).toEqual({});
    expect(validatePlace('', '')).toEqual({ province: 'Elige la provincia.' });
    expect(validatePlace('Pichincha', 'Guayaquil')).toEqual({ city: 'Elige la ciudad.' });
    expect(provinceOfCity('manta')).toBe('Manabí');
  });

  it('el asistente guarda la provincia', async () => {
    const { repo } = setup();
    const { id } = await business(repo, 'basico');
    expect((await repo.getBusiness(id))?.province).toBe('Pichincha');
  });
});
