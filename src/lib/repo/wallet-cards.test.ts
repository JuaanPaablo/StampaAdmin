import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { formatGiftCardCode } from '../domain/wallet-cards';

/** Cupones, gift cards, coordenadas, avisos y Apple en el repo en memoria (contrato de docs/TARJETAS.md). */

const NOW = Date.parse('2026-11-26T15:00:00Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const offerInput = (over: object = {}) => ({ title: 'Postre gratis', description: 'Un postre con tu almuerzo.', startsAt: iso(NOW - DAY), endsAt: iso(NOW + 7 * DAY), ...over });

function setup(seed = false) {
  let now = NOW;
  const repo = createMemoryRepo({ seed, clock: () => now });
  return { repo, tick: (ms: number) => { now += ms; } };
}

async function business(repo: ReturnType<typeof setup>['repo'], plan: 'basico' | 'standard' | 'pro', email = `d${Math.random()}@p.ec`) {
  const { business: b, ownerId } = await repo.createBusinessAccess({ ownerEmail: email, plan });
  const cashier = await repo.upsertStaff(b.id, { name: 'Cajera Uno', role: 'cashier' });
  const c1 = await repo.registerCustomer(b.id, { name: 'Ana Mora', contact: 'ana@c.ec', contactKind: 'email' });
  const c2 = await repo.registerCustomer(b.id, { name: 'Luis Vera', contact: 'luis@c.ec', contactKind: 'email' });
  return { b, ownerId, cashierId: cashier.id, c1, c2 };
}

describe('cupones', () => {
  it('solo con plan Standard o Pro y solo dueño o gerente', async () => {
    const { repo } = setup();
    const basico = await business(repo, 'basico');
    await expect(repo.createOffer(basico.b.id, offerInput(), basico.ownerId)).rejects.toThrow('desde el plan Standard');
    const std = await business(repo, 'standard');
    await expect(repo.createOffer(std.b.id, offerInput(), std.cashierId)).rejects.toThrow('Solo el dueño o un gerente');
    await expect(repo.createOffer(std.b.id, offerInput({ title: 'x' }), std.ownerId)).rejects.toThrow('título');
    const o = await repo.createOffer(std.b.id, offerInput(), std.ownerId);
    expect(o).toMatchObject({ status: 'draft', title: 'Postre gratis', createdBy: std.ownerId });
    expect((await repo.updateOffer(std.b.id, o.id, { title: 'Postre doble' }, std.ownerId)).title).toBe('Postre doble');
    expect(await repo.listOffers(std.b.id)).toHaveLength(1);
  });

  it('enviar crea un cupón por cliente, una vez, y respeta las campañas del mes', async () => {
    const { repo } = setup();
    const s = await business(repo, 'standard');
    const o1 = await repo.createOffer(s.b.id, offerInput(), s.ownerId);
    const sent = await repo.sendOffer(s.b.id, o1.id, s.ownerId);
    expect(sent.offer.status).toBe('sent');
    expect(sent.customerIds.sort()).toEqual([s.c1.id, s.c2.id].sort());
    await expect(repo.sendOffer(s.b.id, o1.id, s.ownerId)).rejects.toThrow('ya se envió');
    await expect(repo.updateOffer(s.b.id, o1.id, { title: 'Otro' }, s.ownerId)).rejects.toThrow('aún no se enviaron');
    expect(await repo.countCampaignsThisMonth(s.b.id)).toBe(1);

    const o2 = await repo.createOffer(s.b.id, offerInput({ title: 'Segundo' }), s.ownerId);
    await repo.sendOffer(s.b.id, o2.id, s.ownerId);
    const o3 = await repo.createOffer(s.b.id, offerInput({ title: 'Tercero' }), s.ownerId);
    await expect(repo.sendOffer(s.b.id, o3.id, s.ownerId)).rejects.toThrow('2 cupones por mes');
    expect((await repo.offerStats(s.b.id))[o1.id]).toEqual({ offerId: o1.id, sent: 2, redeemed: 0, rate: 0 });
  });

  it('el cliente lo ve en su tarjeta; Caja lo canjea una sola vez y queda en la actividad', async () => {
    const { repo, tick } = setup();
    const s = await business(repo, 'standard');
    const o = await repo.createOffer(s.b.id, offerInput(), s.ownerId);
    await repo.sendOffer(s.b.id, o.id, s.ownerId);
    const card = (await repo.getCustomerCard(s.b.id, s.c1.id))!;
    expect(card.offers).toHaveLength(1);
    expect(card.offers[0].offer.title).toBe('Postre gratis');
    const coId = card.offers[0].id;

    const found = await repo.findCustomerOffer(s.b.id, coId);
    expect(found?.customerName).toBe('Ana Mora');
    expect(await repo.findCustomerOffer('otro_negocio', coId)).toBeNull();

    // Si el negocio baja de plan, lo ya enviado se sigue canjeando.
    await repo.updateBusinessPlan(s.b.id, 'basico', null);
    const r = await repo.redeemCustomerOffer(s.b.id, coId, s.cashierId);
    expect(r.redeemedBy).toBe(s.cashierId);
    await expect(repo.redeemCustomerOffer(s.b.id, coId, s.cashierId)).rejects.toThrow('ya se usó');
    expect((await repo.getCustomerCard(s.b.id, s.c1.id))!.offers).toHaveLength(0);
    expect((await repo.offerStats(s.b.id, o.id))[o.id]).toMatchObject({ sent: 2, redeemed: 1, rate: 0.5 });
    expect((await repo.listAudit(s.b.id)).map((a) => a.action)).toEqual(expect.arrayContaining(['offer.create', 'offer.send', 'offer.redeem']));

    // Vence: deja de verse y no se canjea.
    const co2 = (await repo.getCustomerCard(s.b.id, s.c2.id))!.offers[0].id;
    tick(8 * DAY);
    expect((await repo.getCustomerCard(s.b.id, s.c2.id))!.offers).toHaveLength(0);
    await expect(repo.redeemCustomerOffer(s.b.id, co2, s.ownerId)).rejects.toThrow('ya venció');
  });

  it('terminar un cupón lo quita de la tarjeta', async () => {
    const { repo } = setup();
    const s = await business(repo, 'pro');
    const o = await repo.createOffer(s.b.id, offerInput(), s.ownerId);
    await repo.sendOffer(s.b.id, o.id, s.ownerId);
    await expect(repo.endOffer(s.b.id, o.id, s.cashierId)).rejects.toThrow('Solo el dueño');
    expect((await repo.endOffer(s.b.id, o.id, s.ownerId)).status).toBe('ended');
    expect((await repo.getCustomerCard(s.b.id, s.c1.id))!.offers).toHaveLength(0);
  });
});

describe('gift cards', () => {
  it('solo plan Pro vende; cobrar no depende del plan; el saldo nunca queda negativo ni pasa de $500', async () => {
    const { repo } = setup();
    const std = await business(repo, 'standard');
    await expect(repo.issueGiftCard(std.b.id, { amountCents: 2000, staffId: std.ownerId })).rejects.toThrow('plan Pro');

    const p = await business(repo, 'pro');
    await expect(repo.issueGiftCard(p.b.id, { amountCents: 2000, staffId: p.cashierId })).rejects.toThrow('Solo el dueño');
    await expect(repo.issueGiftCard(p.b.id, { amountCents: 60_000, staffId: p.ownerId })).rejects.toThrow('$500,00');
    const { giftCard: g, movement } = await repo.issueGiftCard(p.b.id, { amountCents: 2000, staffId: p.ownerId, customerId: p.c1.id, note: ' Regalo ' });
    expect(g).toMatchObject({ balanceCents: 2000, initialCents: 2000, status: 'active', customerId: p.c1.id });
    expect(g.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
    expect(movement).toMatchObject({ kind: 'issue', amountCents: 2000, balanceAfterCents: 2000, note: 'Regalo' });

    expect((await repo.findGiftCardByCode(p.b.id, formatGiftCardCode(g.code).toLowerCase()))?.id).toBe(g.id);
    expect(await repo.findGiftCardByCode(std.b.id, g.code)).toBeNull();

    const t = await repo.topupGiftCard(p.b.id, g.id, 1000, p.ownerId);
    expect(t.giftCard.balanceCents).toBe(3000);
    await expect(repo.topupGiftCard(p.b.id, g.id, 48_000, p.ownerId)).rejects.toThrow('hasta $470,00');

    await repo.updateBusinessPlan(p.b.id, 'standard', null);
    const c = await repo.chargeGiftCard(p.b.id, g.id, 1250, p.cashierId);
    expect(c.giftCard.balanceCents).toBe(1750);
    expect(c.movement).toMatchObject({ kind: 'charge', amountCents: -1250, balanceAfterCents: 1750 });
    await expect(repo.chargeGiftCard(p.b.id, g.id, 2000, p.cashierId)).rejects.toThrow('Saldo insuficiente: quedan $17,50.');
    await expect(repo.topupGiftCard(p.b.id, g.id, 500, p.ownerId)).rejects.toThrow('plan Pro');

    const v = await repo.voidGiftCard(p.b.id, g.id, p.ownerId, 'Perdida');
    expect(v.giftCard).toMatchObject({ status: 'void', balanceCents: 0 });
    expect(v.movement).toMatchObject({ kind: 'void', amountCents: -1750, balanceAfterCents: 0 });
    await expect(repo.chargeGiftCard(p.b.id, g.id, 100, p.cashierId)).rejects.toThrow('anulada');

    const moves = await repo.listGiftCardMovements(p.b.id, g.id);
    expect(moves.map((m) => m.kind)).toEqual(['void', 'charge', 'topup', 'issue']);
    expect((await repo.listAudit(p.b.id)).filter((a) => a.action.startsWith('gift.')).map((a) => a.action).sort())
      .toEqual(['gift.charge', 'gift.issue', 'gift.topup', 'gift.void']);
    // El registro de actividad nunca guarda el código completo.
    expect((await repo.listAudit(p.b.id)).some((a) => a.detail.includes(g.code))).toBe(false);
  });

  it('la tarjeta del cliente muestra sus gift cards activas', async () => {
    const { repo } = setup();
    const p = await business(repo, 'pro');
    await repo.issueGiftCard(p.b.id, { amountCents: 1500, staffId: p.ownerId, customerId: p.c1.id });
    const sold = await repo.issueGiftCard(p.b.id, { amountCents: 1500, staffId: p.ownerId });
    expect(sold.giftCard.customerId).toBeUndefined();
    expect((await repo.getCustomerCard(p.b.id, p.c1.id))!.giftCards).toHaveLength(1);
    expect((await repo.getCustomerCard(p.b.id, p.c2.id))!.giftCards).toHaveLength(0);
    expect(await repo.listGiftCards(p.b.id, { customerId: p.c1.id })).toHaveLength(1);
    expect(await repo.listGiftCards(p.b.id)).toHaveLength(2);
  });
  it('idempotencia: el mismo requestId nunca mueve el saldo dos veces', async () => {
    const { repo } = setup();
    const p = await business(repo, 'pro');
    const R = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

    // Venta repetida → misma tarjeta, sin crear otra.
    const a = await repo.issueGiftCard(p.b.id, { amountCents: 1000, staffId: p.ownerId, requestId: R(1) });
    const a2 = await repo.issueGiftCard(p.b.id, { amountCents: 1000, staffId: p.ownerId, requestId: R(1) });
    expect(a2.giftCard.id).toBe(a.giftCard.id);
    expect(a2.movement.id).toBe(a.movement.id);
    expect(await repo.listGiftCards(p.b.id)).toHaveLength(1);
    const g = a.giftCard.id;

    // Cobro repetido (doble toque): cobra una sola vez, aunque el segundo ya no tendría saldo.
    const c1 = await repo.chargeGiftCard(p.b.id, g, 1000, p.cashierId, { requestId: R(2) });
    const c2 = await repo.chargeGiftCard(p.b.id, g, 1000, p.cashierId, { requestId: R(2) });
    expect(c1.giftCard.balanceCents).toBe(0);
    expect(c2.movement.id).toBe(c1.movement.id);
    expect(c2.giftCard.balanceCents).toBe(0);

    // Recarga repetida: suma una vez.
    await repo.topupGiftCard(p.b.id, g, 500, p.ownerId, { requestId: R(3) });
    const t2 = await repo.topupGiftCard(p.b.id, g, 500, p.ownerId, { requestId: R(3) });
    expect(t2.giftCard.balanceCents).toBe(500);

    // Sin requestId (o inválido) sí se repite: es otra operación.
    await repo.topupGiftCard(p.b.id, g, 100, p.ownerId, { requestId: 'x' });
    await repo.topupGiftCard(p.b.id, g, 100, p.ownerId);
    expect((await repo.getGiftCard(p.b.id, g))!.balanceCents).toBe(700);

    // Mismo id en otra operación u otra tarjeta → error, sin mover nada.
    await expect(repo.chargeGiftCard(p.b.id, g, 100, p.cashierId, { requestId: R(3) })).rejects.toThrow('ya se registró');
    const other = await repo.issueGiftCard(p.b.id, { amountCents: 300, staffId: p.ownerId });
    await expect(repo.topupGiftCard(p.b.id, other.giftCard.id, 100, p.ownerId, { requestId: R(3) })).rejects.toThrow('ya se registró');
    expect((await repo.getGiftCard(p.b.id, g))!.balanceCents).toBe(700);

    // Anulación repetida: la segunda devuelve la misma (no falla por "anulada").
    const v1 = await repo.voidGiftCard(p.b.id, g, p.ownerId, undefined, R(4));
    const v2 = await repo.voidGiftCard(p.b.id, g, p.ownerId, undefined, R(4));
    expect(v2.movement.id).toBe(v1.movement.id);
    expect(v2.giftCard.status).toBe('void');

    expect(await repo.findGiftCardResultByRequest(p.b.id, R(2))).toMatchObject({ movement: { id: c1.movement.id, kind: 'charge' } });
    expect(await repo.findGiftCardResultByRequest(p.b.id, R(99))).toBeNull();
    // Los ids son por negocio: otro negocio no ve el movimiento.
    const q = await business(repo, 'pro');
    expect(await repo.findGiftCardResultByRequest(q.b.id, R(2))).toBeNull();
    expect((await repo.listGiftCardMovements(p.b.id, g)).filter((m) => m.kind === 'charge')).toHaveLength(1);
  });
});

describe('coordenadas, avisos y Apple', () => {
  it('coordenadas por sucursal: solo activas con coordenadas llegan a la tarjeta', async () => {
    const { repo } = setup();
    const s = await business(repo, 'standard');
    const loc = await repo.upsertLocation(s.b.id, { name: 'Centro' });
    await expect(repo.setLocationCoords(s.b.id, loc.id, { latitude: 120, longitude: 0 })).rejects.toThrow('latitud');
    const withCoords = await repo.setLocationCoords(s.b.id, loc.id, { latitude: -2.17, longitude: -79.9 }, s.ownerId);
    expect(withCoords).toMatchObject({ latitude: -2.17, longitude: -79.9 });
    expect((await repo.getCustomerCard(s.b.id, s.c1.id))!.locations.map((l) => l.id)).toEqual([loc.id]);
    await repo.upsertLocation(s.b.id, { id: loc.id, name: 'Centro', active: false });
    expect((await repo.getCustomerCard(s.b.id, s.c1.id))!.locations).toEqual([]);
    const cleared = await repo.setLocationCoords(s.b.id, loc.id, null);
    expect(cleared.latitude).toBeUndefined();
  });

  it('cuenta avisos por cliente desde una fecha', async () => {
    const { repo, tick } = setup();
    const s = await business(repo, 'standard');
    await repo.logWalletNotification({ businessId: s.b.id, customerId: s.c1.id, platform: 'google', kind: 'offer' });
    tick(DAY + 1000);
    await repo.logWalletNotification({ businessId: s.b.id, customerId: s.c1.id, platform: 'apple', kind: 'offer' });
    expect(await repo.countWalletNotifications(s.b.id, s.c1.id, iso(NOW + 1000))).toBe(1);
    expect(await repo.countWalletNotifications(s.b.id, s.c1.id, iso(NOW - 1000))).toBe(2);
    expect(await repo.countWalletNotifications(s.b.id, s.c2.id, iso(NOW - 1000))).toBe(0);
  });

  it('servicio web de Apple: registrar, listar cambios, tokens y borrar', async () => {
    const { repo, tick } = setup();
    const reg = { deviceLibraryId: 'dev1', pushToken: 'tok1', passTypeId: 'pass.app.stampa', serial: 'cli_1' };
    expect(await repo.appleRegister(reg)).toEqual({ created: true });
    expect(await repo.appleRegister({ ...reg, pushToken: 'tok2' })).toEqual({ created: false });
    expect(await repo.applePushTokensForSerial('pass.app.stampa', 'cli_1')).toEqual(['tok2']);
    const first = await repo.appleSerialsForDevice('dev1', 'pass.app.stampa');
    expect(first.serials).toEqual(['cli_1']);
    expect((await repo.appleSerialsForDevice('dev1', 'pass.app.stampa', first.lastUpdated!)).serials).toEqual([]);
    tick(5000);
    await repo.appleMarkUpdated('pass.app.stampa', 'cli_1');
    expect((await repo.appleSerialsForDevice('dev1', 'pass.app.stampa', first.lastUpdated!)).serials).toEqual(['cli_1']);
    await repo.appleUnregister('dev1', 'pass.app.stampa', 'cli_1');
    expect(await repo.applePushTokensForSerial('pass.app.stampa', 'cli_1')).toEqual([]);
  });

  it('APNs 410: borrar por push token quita el dispositivo y todos sus registros', async () => {
    const { repo } = setup();
    await repo.appleRegister({ deviceLibraryId: 'dev1', pushToken: 'tokA', passTypeId: 'pass.app.stampa', serial: 's1' });
    await repo.appleRegister({ deviceLibraryId: 'dev1', pushToken: 'tokA', passTypeId: 'pass.app.stampa', serial: 's2' });
    await repo.appleRegister({ deviceLibraryId: 'dev2', pushToken: 'tokB', passTypeId: 'pass.app.stampa', serial: 's1' });
    await repo.appleUnregisterToken('tokA');
    expect(await repo.applePushTokensForSerial('pass.app.stampa', 's1')).toEqual(['tokB']);
    expect(await repo.applePushTokensForSerial('pass.app.stampa', 's2')).toEqual([]);
    expect((await repo.appleSerialsForDevice('dev1', 'pass.app.stampa')).serials).toEqual([]);
  });
});

describe('datos de ejemplo', () => {
  it('Café La Esquina (Pro) trae coordenadas, cupones y gift cards', async () => {
    const { repo } = setup(true);
    const b = (await repo.getBusiness('biz_esquina'))!;
    expect(b.plan).toBe('pro');
    const locs = await repo.listLocations('biz_esquina');
    expect(locs.every((l) => typeof l.latitude === 'number' && typeof l.longitude === 'number')).toBe(true);
    const offers = await repo.listOffers('biz_esquina');
    expect(offers.map((o) => o.status).sort()).toEqual(['draft', 'ended', 'sent']);
    const sent = offers.find((o) => o.status === 'sent')!;
    const st = (await repo.offerStats('biz_esquina', sent.id))[sent.id];
    expect(st.sent).toBeGreaterThan(10);
    expect(st.redeemed).toBeGreaterThan(0);
    const gifts = await repo.listGiftCards('biz_esquina');
    expect(gifts).toHaveLength(5);
    expect(gifts.some((g) => g.status === 'void')).toBe(true);
    expect(gifts.some((g) => !g.customerId)).toBe(true);
    for (const g of gifts) {
      const moves = await repo.listGiftCardMovements('biz_esquina', g.id);
      expect(moves[0].balanceAfterCents).toBe(g.balanceCents);
      expect(moves.reduce((s, m) => s + m.amountCents, 0)).toBe(g.balanceCents);
    }
    expect(await repo.countCampaignsThisMonth('biz_esquina')).toBeGreaterThanOrEqual(1);
    const withGift = gifts.find((g) => g.customerId && g.status === 'active')!;
    const card = (await repo.getCustomerCard('biz_esquina', withGift.customerId!))!;
    expect(card.giftCards.map((g) => g.id)).toContain(withGift.id);
    expect(card.locations).toHaveLength(2);
  });

  it('tope de 10 dispositivos por pase: el más antiguo sale', async () => {
    const { repo } = setup();
    for (let i = 1; i <= 11; i++) await repo.appleRegister({ deviceLibraryId: `dev${i}`, pushToken: `tok${i}`, passTypeId: 'pass.app.stampa', serial: 's1' });
    const tokens = await repo.applePushTokensForSerial('pass.app.stampa', 's1');
    expect(tokens).toHaveLength(10);
    expect(tokens).not.toContain('tok1');
    expect(tokens).toContain('tok11');
  });
});
