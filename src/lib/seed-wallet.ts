import type { Customer, CustomerOffer, GiftCard, GiftCardMovement, Location, Offer, Staff } from './contracts';
import { generateGiftCardCode } from './domain/wallet-cards';
import { Rng } from './seed';

/**
 * DATOS DE EJEMPLO de cupones, gift cards y cercanía (solo repo en memoria). Se aplican sobre buildSeed():
 *  - Coordenadas reales aproximadas de sucursales en Guayaquil, Quito y Cuenca.
 *  - Café La Esquina (plan Pro): un cupón enviado hace 6 días (algunos ya canjeados), uno en borrador y uno terminado;
 *    5 gift cards con ventas, recargas y cobros (una anulada y una vendida sin cliente).
 * Determinista y relativo a `now`, como seed.ts.
 */

export interface WalletSeed {
  coords: Record<string, { latitude: number; longitude: number }>;
  offers: Offer[];
  customerOffers: CustomerOffer[];
  giftCards: GiftCard[];
  movements: GiftCardMovement[];
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Sucursales con coordenadas (ids de seed.ts). */
export const DEMO_COORDS: Record<string, { latitude: number; longitude: number }> = {
  loc_esquina_1: { latitude: -2.172034, longitude: -79.905021 },   // Urdesa, Guayaquil
  loc_esquina_2: { latitude: -2.153728, longitude: -79.893102 },   // Mall del Sol, Guayaquil
  loc_petalo_1: { latitude: -0.199764, longitude: -78.486412 },    // La Floresta, Quito
  loc_mesa_1: { latitude: -2.900897, longitude: -79.005281 }       // Calle Larga, Cuenca
};

export function buildWalletSeed(now: number, data: { locations: Location[]; customers: Customer[]; staff: Staff[] }): WalletSeed {
  const out: WalletSeed = { coords: {}, offers: [], customerOffers: [], giftCards: [], movements: [] };
  for (const [id, c] of Object.entries(DEMO_COORDS)) if (data.locations.some((l) => l.id === id)) out.coords[id] = c;

  const bizId = 'biz_esquina';
  const customers = data.customers.filter((c) => c.businessId === bizId);
  const owner = data.staff.find((s) => s.businessId === bizId && s.role === 'owner');
  const manager = data.staff.find((s) => s.businessId === bizId && s.role === 'manager');
  const cashiers = data.staff.filter((s) => s.businessId === bizId && s.role === 'cashier');
  if (!customers.length || !owner) return out;
  const rng = new Rng(7707);
  const iso = (t: number) => new Date(t).toISOString();
  const dayStartEc = (t: number) => Math.floor((t - 5 * HOUR) / DAY) * DAY + 5 * HOUR;   // 00:00 en Ecuador
  const today0 = dayStartEc(now);
  const locs = ['loc_esquina_1', 'loc_esquina_2'];
  const cashier = () => (cashiers.length ? rng.pick(cashiers).id : owner.id);

  /* ---------- Cupones ---------- */
  const sentAt = now - 6 * DAY - 3 * HOUR;
  const sent: Offer = {
    id: 'ofr_esquina_1', businessId: bizId, title: '2x1 en capuchinos', description: 'Lleva dos capuchinos medianos y paga solo uno.',
    terms: 'Válido de lunes a viernes. Un cupón por cliente. No acumulable con otras promociones.',
    startsAt: iso(today0 - 6 * DAY), endsAt: iso(today0 + 9 * DAY - 1000), status: 'sent', sentAt: iso(sentAt),
    createdBy: owner.id, createdAt: iso(sentAt - 2 * HOUR)
  };
  const draft: Offer = {
    id: 'ofr_esquina_2', businessId: bizId, title: 'Postre gratis en tu cumpleaños', description: 'Un brownie o cheesecake de regalo con cualquier bebida.',
    startsAt: iso(today0 + DAY), endsAt: iso(today0 + 31 * DAY - 1000), status: 'draft',
    createdBy: (manager ?? owner).id, createdAt: iso(now - 1 * DAY)
  };
  const ended: Offer = {
    id: 'ofr_esquina_3', businessId: bizId, title: 'Café de la casa a $1', description: 'Café americano pequeño a solo $1 por el Día del Café.',
    startsAt: iso(today0 - 40 * DAY), endsAt: iso(today0 - 33 * DAY - 1000), status: 'ended', sentAt: iso(today0 - 40 * DAY + 9 * HOUR),
    createdBy: owner.id, createdAt: iso(today0 - 41 * DAY)
  };
  out.offers.push(sent, draft, ended);

  // Recibieron el cupón todos los clientes que existían al enviarlo; ~25 % ya lo canjeó.
  let n = 0;
  for (const c of customers) {
    if (Date.parse(c.createdAt) > sentAt) continue;
    const co: CustomerOffer = { id: `cof_esquina_${String(++n).padStart(3, '0')}`, offerId: sent.id, businessId: bizId, customerId: c.id, createdAt: iso(sentAt) };
    if (rng.chance(0.25)) {
      const at = sentAt + rng.int(2, 140) * HOUR;
      if (at < now) Object.assign(co, { redeemedAt: iso(at), redeemedBy: cashier(), redeemedLocationId: rng.pick(locs) });
    }
    out.customerOffers.push(co);
  }
  for (const c of customers.slice(0, 18)) {
    if (Date.parse(c.createdAt) > Date.parse(ended.sentAt!)) continue;
    const co: CustomerOffer = { id: `cof_esquina_${String(++n).padStart(3, '0')}`, offerId: ended.id, businessId: bizId, customerId: c.id, createdAt: ended.sentAt! };
    if (rng.chance(0.4)) Object.assign(co, { redeemedAt: iso(Date.parse(ended.startsAt) + rng.int(10, 150) * HOUR), redeemedBy: cashier(), redeemedLocationId: locs[0] });
    out.customerOffers.push(co);
  }

  /* ---------- Gift cards ---------- */
  const used = new Set<string>();
  let m = 0;
  const card = (i: number, customer: Customer | undefined, daysAgo: number, initial: number, ops: { kind: 'topup' | 'charge' | 'void'; cents?: number; daysAgo: number; note?: string }[]) => {
    let code = generateGiftCardCode(() => rng.next());
    while (used.has(code)) code = generateGiftCardCode(() => rng.next());
    used.add(code);
    const created = now - daysAgo * DAY;
    const g: GiftCard = {
      id: `gft_esquina_${i}`, businessId: bizId, customerId: customer?.id, code, balanceCents: 0, initialCents: initial,
      status: 'active', createdAt: iso(created), createdBy: owner.id
    };
    if (!customer) delete g.customerId;
    const move = (kind: GiftCardMovement['kind'], amount: number, at: number, staffId: string, note?: string) => {
      g.balanceCents += amount;
      const mv: GiftCardMovement = {
        id: `gmv_esquina_${String(++m).padStart(3, '0')}`, giftCardId: g.id, businessId: bizId, kind, amountCents: amount,
        balanceAfterCents: g.balanceCents, staffId, locationId: locs[0], createdAt: iso(at)
      };
      if (note) mv.note = note;
      out.movements.push(mv);
    };
    move('issue', initial, created, owner.id, customer ? undefined : 'Vendida para regalo');
    for (const op of ops) {
      const at = now - op.daysAgo * DAY + rng.int(1, 8) * HOUR;
      if (op.kind === 'void') { move('void', -g.balanceCents, at, owner.id, op.note); g.status = 'void'; continue; }
      move(op.kind, op.kind === 'charge' ? -op.cents! : op.cents!, at, op.kind === 'charge' ? cashier() : (manager ?? owner).id, op.note);
    }
    out.giftCards.push(g);
  };
  const regulars = customers.filter((c) => c.totalStamps > 3);
  const pick = (k: number) => regulars[k] ?? customers[k];
  card(1, pick(0), 45, 2500, [{ kind: 'charge', cents: 650, daysAgo: 40 }, { kind: 'charge', cents: 425, daysAgo: 21 }, { kind: 'topup', cents: 2000, daysAgo: 10 }, { kind: 'charge', cents: 780, daysAgo: 2 }]);
  card(2, pick(1), 30, 5000, [{ kind: 'charge', cents: 1250, daysAgo: 12 }]);
  card(3, pick(2), 14, 1000, []);
  card(4, undefined, 8, 3000, [{ kind: 'charge', cents: 900, daysAgo: 3 }]);
  card(5, pick(3), 60, 2000, [{ kind: 'charge', cents: 500, daysAgo: 50 }, { kind: 'void', daysAgo: 49, note: 'Tarjeta perdida, se emitió otra' }]);
  out.giftCards.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return out;
}
