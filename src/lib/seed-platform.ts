import type {
  AdminActionKind, AdminPayment, Business, BusinessType, Customer, Location, MarketingGeneration, PaymentMethod, Plan,
  Program, Redemption, StampClaim, StampCode
} from './contracts';
import type { Rejection } from './domain/analytics';
import { DAY_MS, localDayStart, localParts } from './domain/dates';
import { addMonthsToDay, ecDayKey, ecEndOfDayIso, planPriceCents } from './domain/admin-insights';
import { foldText, initials } from './domain/text';
import { DEMO_PINS, FEMALE, MALE, Rng, SURNAMES, type SeedData, type SeedStaff } from './seed';
import { getTemplate } from './templates';

/**
 * DATOS INVENTADOS PARA EL PANEL DE ADMINISTRADOR (solo repo en memoria, `npm run dev`).
 * buildPlatformDemo(now) agrega 12 negocios con 12 meses de historia en todos los estados que el admin debe ver
 * (activos verde/amarillo/rojo, por vencer, vencido, suspendido, atascado en el asistente, invitación vencida) y
 * completa los 5 negocios de seed.ts con vencimiento, teléfono, pagos e historial. Determinista y relativo a `now`.
 * Los contadores de cada cliente cuadran con sus sellos y canjes, igual que en seed.ts.
 * La versión para Supabase está en supabase/demo/admin_demo_seed.sql.
 */

const OFF = -300;
const HOUR = 3_600_000;

export interface DemoAction { id: string; businessId: string; adminId?: string; kind: AdminActionKind; detail: Record<string, unknown>; createdAt: string }

export interface PlatformDemo {
  seed: SeedData;
  /** Cambios a los negocios de seed.ts (vencimiento, renovación). */
  patches: Record<string, Partial<Business>>;
  phones: Record<string, string>;
  notes: Record<string, string>;
  payments: AdminPayment[];
  actions: DemoAction[];
  marketing: MarketingGeneration[];
  /** Dueños sin contraseña (invitación pendiente) y el vencimiento de su invitación. */
  invites: { staffId: string; expiresAt: number }[];
}

interface DemoCfg {
  key: string; name: string; type: BusinessType; city: string; province: string; plan: Plan;
  /** Días desde el alta. */
  age: number;
  status: 'active' | 'setup' | 'suspended';
  /** Días hasta el vencimiento (negativo = vencido). null = sin fecha. */
  expiresIn: number | null;
  autoRenew?: boolean;
  /** Visitas diarias al final del periodo (crece desde ~35 %). 0 = no sella. */
  daily: number;
  /** Días sin sellos al final (inactividad). */
  idle?: number;
  customers: number;
  owner: string; manager?: string; cashiers: string[];
  phone?: string; note?: string;
  /** Meses que cubre cada pago (1 = mensual, 3 = trimestral). */
  cycle?: number;
  /** Solo 'setup': 'stuck' = ya creó la contraseña; 'expired' / 'pending' = invitación vencida / vigente. */
  setup?: 'stuck' | 'expired' | 'pending';
  /** Suspendido hace N días. */
  suspendedAgo?: number;
  /** Plan anterior (cambio de plan hace 4 meses). */
  upgradedFrom?: Plan;
  /** Generaciones de IA este mes: textos y fotos. */
  ai?: [number, number];
}

const DEMO: DemoCfg[] = [
  { key: 'sabor', name: 'Sabor Manabita', type: 'restaurante', city: 'Portoviejo', province: 'Manabí', plan: 'pro', age: 360, status: 'active', expiresIn: 12, daily: 11, customers: 170, owner: 'Ramón Mendoza', manager: 'Gina Zambrano', cashiers: ['Tito Loor', 'Karen Cedeño'], phone: '+593987654321', note: 'Dos locales. Paga por transferencia.', cycle: 3, ai: [34, 12] },
  { key: 'dulce', name: 'Panadería Dulce Hogar', type: 'panaderia', city: 'Quito', province: 'Pichincha', plan: 'standard', age: 330, status: 'active', expiresIn: 3, daily: 16, customers: 210, owner: 'Patricia Guerrero', manager: 'Miguel Ortiz', cashiers: ['Andrea Lara'], phone: '+593991112233', upgradedFrom: 'basico', ai: [21, 6] },
  { key: 'zen', name: 'Spa Zen Cumbayá', type: 'spa', city: 'Quito', province: 'Pichincha', plan: 'pro', age: 300, status: 'active', expiresIn: 20, autoRenew: true, daily: 5, idle: 10, customers: 90, owner: 'Lucía Salazar', manager: 'Diana Chávez', cashiers: ['Paúl Herrera'], phone: '+593998877665', ai: [12, 9] },
  { key: 'rizos', name: 'Peluquería Rizos y Estilo', type: 'peluqueria', city: 'Guayaquil', province: 'Guayas', plan: 'basico', age: 270, status: 'active', expiresIn: -8, daily: 6, idle: 25, customers: 85, owner: 'Johanna Villamar', cashiers: ['Erika Tomalá'], phone: '+593984561230', note: 'Dice que paga a fin de mes.', ai: [3, 0] },
  { key: 'pepe', name: 'Tienda Don Pepe', type: 'tienda', city: 'Ambato', province: 'Tungurahua', plan: 'basico', age: 240, status: 'active', expiresIn: 27, daily: 9, customers: 120, owner: 'José Naranjo', cashiers: ['Rosa Naranjo'], phone: '+593967894561', ai: [6, 2] },
  { key: 'parque', name: 'Café del Parque', type: 'cafeteria', city: 'Loja', province: 'Loja', plan: 'standard', age: 200, status: 'active', expiresIn: 6, autoRenew: true, daily: 13, customers: 150, owner: 'Valeria Espinoza', manager: 'Andrés Ochoa', cashiers: ['Mateo Jiménez', 'Camila Torres'], phone: '+593978123456', ai: [18, 5] },
  { key: 'montana', name: 'CrossFit Montaña', type: 'gimnasio', city: 'Cuenca', province: 'Azuay', plan: 'standard', age: 150, status: 'suspended', expiresIn: -35, daily: 10, idle: 22, customers: 75, owner: 'Sebastián Moreno', manager: 'Paola Rivera', cashiers: ['Henry Briones'], phone: '+593995551234', suspendedAgo: 20, note: 'Suspendido por falta de pago. Llamar antes de reactivar.' },
  { key: 'mitad', name: 'Flores Mitad del Mundo', type: 'floristeria', city: 'Quito', province: 'Pichincha', plan: 'standard', age: 90, status: 'active', expiresIn: 58, daily: 5, customers: 60, owner: 'Carolina Paredes', cashiers: ['Mónica Delgado'], phone: '+593963214785', cycle: 3, ai: [9, 4] },
  { key: 'station', name: 'Burger Station Samborondón', type: 'restaurante', city: 'Samborondón', province: 'Guayas', plan: 'pro', age: 45, status: 'active', expiresIn: 15, daily: 0, customers: 0, owner: 'Diego Cabrera', manager: 'Ximena Franco', cashiers: ['Bryan Ponce'], phone: '+593993216547', note: 'Imprimió el póster pero aún no lo usa.' },
  { key: 'polar', name: 'Heladería Polar', type: 'otro', city: 'Manta', province: 'Manabí', plan: 'basico', age: 6, status: 'setup', setup: 'stuck', expiresIn: 24, daily: 0, customers: 0, owner: 'Fabián Alcívar', cashiers: [], phone: '+593981237894' },
  { key: 'nuevo1', name: 'Negocio nuevo', type: 'otro', city: '', province: '', plan: 'standard', age: 5, status: 'setup', setup: 'expired', expiresIn: 25, daily: 0, customers: 0, owner: 'mariela.cevallos', cashiers: [], note: 'Pizzería en Machala, 2 sucursales.' },
  { key: 'nuevo2', name: 'Negocio nuevo', type: 'otro', city: '', province: '', plan: 'pro', age: 1, status: 'setup', setup: 'pending', expiresIn: 30, daily: 0, customers: 0, owner: 'gerencia.lacasona', cashiers: [] }
];

/** Vencimiento, teléfono y pagos de los 5 negocios de seed.ts. */
const BASE: { id: string; expiresIn: number; autoRenew?: boolean; phone: string; cycle?: number; ai?: [number, number] }[] = [
  { id: 'biz_esquina', expiresIn: 18, phone: '+593991234567', ai: [14, 4] },
  { id: 'biz_pulso', expiresIn: 2, phone: '+593992345678', ai: [5, 1] },
  { id: 'biz_petalo', expiresIn: 9, autoRenew: true, phone: '+593993456789', ai: [7, 3] },
  { id: 'biz_mesa', expiresIn: -4, phone: '+593994567890' },
  { id: 'biz_donlucho', expiresIn: 40, phone: '+593995678901', cycle: 3, ai: [2, 0] }
];

/** Peso de cada día de la semana (0 = domingo): fines de semana más altos. */
const WEEKDAY_W = [1.25, 0.75, 0.8, 0.85, 0.95, 1.3, 1.45];
const HOURS_W = [0, 0, 0, 0, 0, 0, 0, .2, .6, .8, .9, .8, 1, 1, .8, .6, .6, .8, 1, .9, .6, .3, 0, 0];
const METHODS: PaymentMethod[] = ['transferencia', 'transferencia', 'transferencia', 'efectivo', 'efectivo', 'tarjeta', 'otro'];
const pad = (n: number, w: number) => String(n).padStart(w, '0');

export function buildPlatformDemo(now: number = Date.now(), base: Business[] = []): PlatformDemo {
  const out: PlatformDemo = {
    seed: { businesses: [], locations: [], staff: [], programs: [], customers: [], codes: [], redemptions: [], audit: [], rejections: [] },
    patches: {}, phones: {}, notes: {}, payments: [], actions: [], marketing: [], invites: []
  };
  const rng = new Rng(9090);
  const today0 = localDayStart(now, OFF);
  const act = (businessId: string, kind: AdminActionKind, at: number, detail: Record<string, unknown> = {}) =>
    out.actions.push({ id: `act_demo_${pad(out.actions.length + 1, 4)}`, businessId, adminId: 'adm_demo', kind, detail, createdAt: new Date(Math.min(at, now - 60_000)).toISOString() });

  /* ---------- Pagos: hacia atrás desde el vencimiento, un periodo por pago ---------- */
  const payments = (b: Pick<Business, 'id' | 'plan' | 'createdAt'>, expiresAt: string, cycle = 1) => {
    const periods: { from: string; to: string }[] = [];
    let to = ecDayKey(expiresAt);
    // El primer pago cubre desde el alta (con 10 días de tolerancia: no se cobra un periodo antes de existir).
    const firstFrom = ecDayKey(Date.parse(b.createdAt) + 10 * DAY_MS);
    for (let i = 0; i < 40; i++) {
      const from = addMonthsToDay(to, -cycle);
      periods.push({ from, to });
      if (from <= firstFrom) break;
      to = from;
    }
    for (const p of periods.reverse()) {
      const paidMs = Math.max(Date.parse(`${p.from}T17:00:00Z`) - rng.int(0, 3) * DAY_MS, Date.parse(b.createdAt) + HOUR);
      if (paidMs > now - HOUR) continue;
      const paidAt = ecDayKey(paidMs);
      const method = rng.pick(METHODS);
      const payment: AdminPayment = {
        id: `pay_demo_${pad(out.payments.length + 1, 4)}`, businessId: b.id, amountCents: planPriceCents(b.plan) * cycle, paidAt, plan: b.plan,
        months: cycle, previousExpiresAt: ecEndOfDayIso(p.from), newExpiresAt: ecEndOfDayIso(p.to), method,
        note: method === 'otro' ? 'Pago por PayPhone.' : undefined, createdBy: 'adm_demo', createdAt: new Date(paidMs + 2 * HOUR).toISOString()
      };
      out.payments.push(payment);
      act(b.id, 'payment_recorded', paidMs + 2 * HOUR, { amountCents: payment.amountCents, months: cycle, newExpiresAt: payment.newExpiresAt, method });
    }
  };

  const aiUsage = (businessId: string, staffId: string | undefined, texts: number, images: number) => {
    const monthStart = Date.parse(`${ecDayKey(now).slice(0, 7)}-01T05:00:00Z`);
    const span = Math.max(HOUR, now - monthStart - HOUR);
    const kinds = ['post', 'post', 'data_post', 'review_reply', 'calendar'] as const;
    for (let i = 0; i < texts + images; i++) {
      const isImage = i >= texts;
      out.marketing.push({
        id: `mkt_demo_${pad(out.marketing.length + 1, 4)}`, businessId, staffId, kind: isImage ? 'photo_edit' : rng.pick(kinds),
        topic: isImage ? 'retoque' : 'Promoción de la semana', output: {}, model: isImage ? 'fal-ai/bytedance/seedream/v5/lite/edit' : 'deepseek-chat',
        promptTokens: isImage ? 0 : rng.int(450, 950), cachedTokens: isImage ? 0 : rng.int(250, 420), completionTokens: isImage ? 0 : rng.int(500, 1400),
        createdAt: new Date(monthStart + Math.floor(rng.next() * span)).toISOString()
      });
    }
  };

  /* ---------- Negocios de seed.ts ---------- */
  for (const cfg of BASE) {
    const b = base.find((x) => x.id === cfg.id);
    if (!b) continue;
    const expiresAt = ecEndOfDayIso(ecDayKey(now + cfg.expiresIn * DAY_MS));
    out.patches[b.id] = { planExpiresAt: expiresAt, autoRenew: !!cfg.autoRenew, setupCompletedAt: b.setupCompletedAt ?? b.createdAt };
    out.phones[b.id] = cfg.phone;
    act(b.id, 'access_created', Date.parse(b.createdAt) - HOUR, { email: `dueno@${b.id.replace('biz_', '')}.demo`, plan: b.plan });
    act(b.id, 'phone_changed', Date.parse(b.createdAt) + DAY_MS, { to: cfg.phone });
    payments(b, expiresAt, cfg.cycle);
    if (cfg.ai) aiUsage(b.id, undefined, cfg.ai[0], cfg.ai[1]);
  }

  /* ---------- Negocios nuevos ---------- */
  for (const cfg of DEMO) {
    const id = `biz_demo_${cfg.key}`;
    const created = today0 - cfg.age * DAY_MS + rng.int(9, 17) * HOUR;
    const isSetup = cfg.status === 'setup';
    const setupDone = isSetup ? undefined : created + rng.int(1, 3) * DAY_MS;
    const slug = isSetup && cfg.setup !== 'stuck' ? `nuevo-${cfg.key}` : foldText(cfg.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const expiresAt = cfg.expiresIn === null ? undefined : ecEndOfDayIso(ecDayKey(now + cfg.expiresIn * DAY_MS));
    const business: Business = {
      id, name: cfg.name, slug, type: cfg.type, city: cfg.city || undefined, province: cfg.province || undefined, country: 'EC', currency: 'USD',
      timezone: 'America/Guayaquil', plan: cfg.plan, createdAt: new Date(created).toISOString(), status: cfg.status,
      planExpiresAt: expiresAt, autoRenew: !!cfg.autoRenew,
      setupCompletedAt: setupDone ? new Date(setupDone).toISOString() : undefined,
      suspendedAt: cfg.suspendedAgo ? new Date(now - cfg.suspendedAgo * DAY_MS).toISOString() : undefined
    };
    out.seed.businesses.push(business);
    if (cfg.phone) out.phones[id] = cfg.phone;
    if (cfg.note) out.notes[id] = cfg.note;

    const tpl = getTemplate(cfg.type);
    const program: Program = { businessId: id, ...structuredClone(tpl.program), logoText: isSetup && cfg.setup !== 'stuck' ? 'ST' : initials(cfg.name) };
    out.seed.programs.push(program);
    const locs: Location[] = isSetup && cfg.setup !== 'stuck' ? [] : [{ id: `loc_demo_${cfg.key}_1`, businessId: id, name: 'Principal', address: `${cfg.city}, centro`, active: true }];
    if (cfg.plan === 'pro' && !isSetup) locs.push({ id: `loc_demo_${cfg.key}_2`, businessId: id, name: 'Sucursal norte', address: `${cfg.city}, norte`, active: true });
    out.seed.locations.push(...locs);

    /* Equipo */
    const ownerEmail = cfg.owner.includes(' ') ? `${foldText(cfg.owner.split(' ')[0])}@${cfg.key}.demo` : `${cfg.owner}@gmail.demo`;
    const mk = (key: string, name: string, role: SeedStaff['role'], withEmail: boolean): SeedStaff => ({
      id: `emp_demo_${cfg.key}_${key}`, businessId: id, name, role, active: true, locationId: locs[0]?.id, hasPin: true,
      email: withEmail ? (role === 'owner' ? ownerEmail : `${foldText(name.split(' ')[0])}@${cfg.key}.demo`) : undefined,
      createdAt: new Date(created + (role === 'owner' ? 0 : rng.int(2, 9) * DAY_MS)).toISOString(),
      pin: DEMO_PINS[role === 'owner' ? 'owner' : role === 'manager' ? 'manager' : 'cashier']
    });
    const owner = mk('owner', cfg.owner.includes(' ') ? cfg.owner : cfg.owner.split('.')[0], 'owner', true);
    const team: SeedStaff[] = [owner];
    if (cfg.manager) team.push(mk('manager', cfg.manager, 'manager', true));
    cfg.cashiers.forEach((n, i) => team.push(mk(`cashier${i + 1}`, n, 'cashier', i === 0)));
    if (cfg.key === 'sabor') team[team.length - 1].active = false;   // alguien que ya no trabaja ahí
    out.seed.staff.push(...team);
    if (cfg.setup === 'expired' || cfg.setup === 'pending') {
      out.invites.push({ staffId: owner.id, expiresAt: cfg.setup === 'expired' ? now - 2 * DAY_MS - 3 * HOUR : now + 47 * HOUR });
    }

    /* Historial del admin */
    act(id, 'access_created', created, { email: ownerEmail, plan: cfg.upgradedFrom ?? cfg.plan });
    if (cfg.phone) act(id, 'phone_changed', created + 2 * HOUR, { to: cfg.phone });
    if (cfg.note) act(id, 'note_changed', created + 3 * HOUR);
    if (cfg.upgradedFrom) act(id, 'plan_changed', now - 120 * DAY_MS, { from: cfg.upgradedFrom, to: cfg.plan });
    if (cfg.autoRenew) act(id, 'expiry_changed', created + DAY_MS, { autoRenew: true });
    if (cfg.suspendedAgo) act(id, 'suspended', now - cfg.suspendedAgo * DAY_MS);
    if (cfg.setup === 'expired') act(id, 'access_resent', created + 2 * HOUR, { kind: 'invite', email: ownerEmail });
    if (expiresAt) payments({ id, plan: cfg.plan, createdAt: business.createdAt }, expiresAt, cfg.cycle);
    if (cfg.ai) aiUsage(id, owner.id, cfg.ai[0], cfg.ai[1]);

    if (setupDone) out.seed.audit.push({ id: `aud_demo_${cfg.key}_0001`, businessId: id, staffId: owner.id, action: 'business.ready', detail: `${cfg.name} terminó su configuración.`, at: new Date(setupDone).toISOString() });
    if (!setupDone || cfg.daily <= 0) continue;
    simulateActivity(cfg, id, program, locs, team, setupDone, now, rng, out.seed);
  }
  return out;
}

/** Clientes, visitas (un código por visita), canjes y un par de anulaciones, con crecimiento y fines de semana más altos. */
function simulateActivity(cfg: DemoCfg, id: string, program: Program, locs: Location[], team: SeedStaff[], start: number, now: number, rng: Rng, out: SeedData): void {
  const end = now - (cfg.idle ?? 0) * DAY_MS - (cfg.idle ? 0 : 20 * 60_000);
  const span = Math.max(DAY_MS, end - start);
  const cashiers = team.filter((s) => s.role === 'cashier' && s.active);
  const sellers = cashiers.length ? cashiers : team;
  const approver = team.find((s) => s.role === 'manager') ?? team[0];

  /* Clientes: el alta se concentra hacia el final (crecimiento). */
  const customers: Customer[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < cfg.customers; i++) {
    let name: string;
    do { name = `${rng.pick(rng.chance(0.55) ? FEMALE : MALE)} ${rng.pick(SURNAMES)}`; } while (usedNames.has(name));
    usedNames.add(name);
    const t = start + Math.floor(span * Math.pow((i + rng.next()) / cfg.customers, 0.7));
    const email = `${foldText(name).replace(/[^a-z]+/g, '.')}${rng.int(1, 99)}@correo.demo`;
    customers.push({
      id: `cli_demo_${cfg.key}_${pad(i + 1, 4)}`, businessId: id, name, contact: email, contactKind: 'email',
      birthday: rng.chance(0.8) ? { d: rng.int(1, 28), m: rng.int(0, 11) } : undefined,
      consentAt: new Date(t).toISOString(), createdAt: new Date(t).toISOString(), emailVerifiedAt: new Date(t).toISOString(),
      stamps: 0, totalStamps: 0, rewardsRedeemed: 0, wallet: rng.pick([undefined, 'google', 'apple'] as const)
    });
  }
  if (!customers.length) return;

  /** Cuántos clientes ya existían en `t` (están ordenados por alta). */
  const createdMs = customers.map((c) => Date.parse(c.createdAt));
  const createdBefore = (t: number) => { let lo = 0; let hi = createdMs.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (createdMs[mid] <= t) lo = mid + 1; else hi = mid; } return lo; };

  /* Visitas por día */
  const visits: { c: number; t: number }[] = [];
  const lastDay = new Map<number, number>();
  const firstDay = localDayStart(start, OFF) + DAY_MS;
  for (let day = firstDay; day < end; day += DAY_MS) {
    const progress = (day - start) / span;
    const wd = localParts(day + 12 * HOUR, OFF).wd;
    const expected = cfg.daily * (0.35 + 0.65 * progress) * WEEKDAY_W[wd] * (0.7 + 0.6 * rng.next());
    const n = Math.floor(expected) + (rng.chance(expected % 1) ? 1 : 0);
    for (let v = 0; v < n; v++) {
      const t = day + rng.weighted(HOURS_W) * HOUR + rng.int(0, 59) * 60_000 + rng.int(0, 59) * 1000;
      if (t >= end) continue;
      // Los clientes antiguos vuelven más (fieles); los nuevos, menos.
      const max = createdBefore(t);
      if (max === 0) continue;
      const c = rng.chance(0.45) ? Math.floor(rng.next() * Math.max(1, Math.ceil(max * 0.3))) : Math.floor(rng.next() * max);
      if (lastDay.get(c) === day) continue;
      lastDay.set(c, day);
      visits.push({ c, t });
    }
  }
  visits.sort((a, b) => a.t - b.t);

  /* Códigos y reclamos (uno por visita) */
  const codes: StampCode[] = [];
  const claimOf: StampClaim[] = [];
  visits.forEach((v, i) => {
    const cu = customers[v.c];
    const seller = rng.pick(sellers);
    const created = v.t - rng.int(20, 50) * 1000;
    const codeId = `cod_demo_${cfg.key}_${pad(i + 1, 5)}`;
    const claim: StampClaim = { id: `clm_demo_${cfg.key}_${pad(i + 1, 5)}`, codeId, customerId: cu.id, customerName: cu.name, at: new Date(v.t).toISOString() };
    claimOf.push(claim);
    codes.push({
      id: codeId, businessId: id, locationId: seller.locationId ?? locs[0]?.id, code: pad(rng.int(0, 999_999), 6), ticket: `D-${pad(i + 1, 5)}`,
      amountCents: program.requireAmount ? Math.round((program.minSpendCentsPerStamp + rng.int(0, program.minSpendCentsPerStamp)) / 5) * 5 : 0,
      seats: 1, createdBy: seller.id, createdAt: new Date(created).toISOString(), expiresAt: new Date(created + program.codeTtlSeconds * 1000).toISOString(),
      attempts: 0, claims: [claim]
    });
  });

  /* Sellos y canjes por cliente, en orden */
  const redemptions: Redemption[] = [];
  const byCustomer = new Map<number, number[]>();
  visits.forEach((v, i) => { const arr = byCustomer.get(v.c) ?? []; arr.push(i); byCustomer.set(v.c, arr); });
  const current: number[] = [];   // índices de visitas del ciclo actual (candidatas a anular)
  for (const [c, idxs] of byCustomer) {
    const cu = customers[c];
    let stamps = 0;
    let cycle: number[] = [];
    idxs.forEach((vi, j) => {
      stamps++; cu.totalStamps++; cycle.push(vi);
      if (stamps >= program.stampsRequired) {
        const t = visits[vi].t;
        const next = idxs[j + 1] !== undefined ? visits[idxs[j + 1]].t : Infinity;
        let rt = Math.min(t + rng.int(10, 48 * 60) * 60_000, next - 10 * 60_000, now - 5 * 60_000);
        if (rt <= t) rt = t + 60_000;
        redemptions.push({
          id: `can_demo_${cfg.key}_${pad(redemptions.length + 1, 4)}`, businessId: id, customerId: cu.id, customerName: cu.name,
          staffId: rng.pick(sellers).id, at: new Date(rt).toISOString(), rewardTitle: program.rewardTitle
        });
        cu.rewardsRedeemed++; stamps = 0; cycle = [];
      }
    });
    cu.stamps = stamps;
    current.push(...cycle);
    const last = idxs[idxs.length - 1];
    cu.lastVisitAt = new Date(visits[last].t).toISOString();
  }

  /* Dos anulaciones recientes (sellos del ciclo actual: el contador baja sin romper la cuenta) */
  const recent = current.filter((vi) => visits[vi].t > now - 25 * DAY_MS);
  for (const vi of rng.shuffle(recent).slice(0, 2)) {
    const claim = claimOf[vi];
    claim.voidedAt = new Date(Math.min(visits[vi].t + rng.int(5, 60) * 60_000, now - 60_000)).toISOString();
    claim.voidedBy = approver.id;
    const cu = customers[visits[vi].c];
    cu.stamps = Math.max(0, cu.stamps - 1); cu.totalStamps = Math.max(0, cu.totalStamps - 1);
    const kept = codes.filter((x) => x.claims[0].customerId === cu.id && !x.claims[0].voidedAt).map((x) => Date.parse(x.claims[0].at));
    cu.lastVisitAt = kept.length ? new Date(Math.max(...kept)).toISOString() : undefined;
  }

  /* Un ticket repetido reciente (alerta) */
  const rejections: Rejection[] = [];
  if (codes.length > 5) {
    const target = codes[codes.length - 3];
    rejections.push({ id: `rej_demo_${cfg.key}_001`, businessId: id, kind: 'duplicate_ticket', staffId: target.createdBy, ticket: target.ticket, codeId: target.id, at: new Date(Math.min(Date.parse(target.createdAt) + 2 * HOUR, now - 60_000)).toISOString() });
  }

  out.customers.push(...customers);
  out.codes.push(...codes);
  out.redemptions.push(...redemptions);
  out.rejections.push(...rejections);
}
