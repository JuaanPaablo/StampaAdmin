import type {
  AuditEntry, Business, BusinessType, Customer, Location, Program, Redemption, Role, Staff, StampClaim, StampCode
} from './contracts';
import { generateCode } from './domain';
import type { Rejection } from './domain/analytics';
import { DAY_MS, localDayStart, localParts } from './domain/dates';
import { cupos, foldText, initials } from './domain/text';
import { getTemplate } from './templates';

/**
 * DATOS DE EJEMPLO. buildSeed(now) genera cinco negocios de tipos distintos con 90 días de historial.
 * - Determinista: la semilla pseudoaleatoria es fija, así que cada arranque produce la misma estructura.
 * - Las fechas son RELATIVAS a `now`, para que el panel siempre se vea vivo.
 * - La historia se simula en orden cronológico, de modo que los contadores de cada cliente (sellos, canjes, última visita)
 *   cuadran exactamente con los reclamos y canjes registrados.
 */

/** Contraseña común de las cuentas de ejemplo (solo repo en memoria). */
export const DEMO_PASSWORD = 'Stampa-Demo-2026';
export const DEMO_PINS = { owner: '1234', manager: '2345', cashier: '1111' } as const;
export const SEED_BUSINESS_IDS = ['biz_esquina', 'biz_pulso', 'biz_petalo', 'biz_mesa', 'biz_donlucho'] as const;

export interface SeedStaff extends Staff { pin: string }
export interface SeedData {
  businesses: Business[];
  locations: Location[];
  staff: SeedStaff[];
  programs: Program[];
  customers: Customer[];
  codes: StampCode[];
  redemptions: Redemption[];
  audit: AuditEntry[];
  rejections: Rejection[];
}

/* ---------- Generador pseudoaleatorio ---------- */

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }
  int(a: number, b: number) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((x, y) => x + y, 0);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }
}

/* ---------- Catálogos ---------- */

export const FEMALE = ['María', 'Andrea', 'Daniela', 'Gabriela', 'Camila', 'Valeria', 'Paola', 'Karla', 'Fernanda', 'Estefanía', 'Michelle', 'Jéssica', 'Carolina', 'Mónica', 'Tatiana', 'Lorena', 'Verónica', 'Ximena', 'Nathaly', 'Rosa', 'Mayra', 'Katherine', 'Doménica', 'Pamela', 'Lissette', 'Dayana'];
export const MALE = ['Juan', 'Carlos', 'Luis', 'José', 'Diego', 'Andrés', 'Kevin', 'Bryan', 'Jorge', 'Wilson', 'Fabián', 'Mauricio', 'Santiago', 'Esteban', 'Galo', 'Patricio', 'Xavier', 'Byron', 'Cristian', 'Darwin', 'Mateo', 'Sebastián', 'Alexis', 'Henry', 'Gustavo', 'Iván'];
export const SURNAMES = ['Cevallos', 'Zambrano', 'Mero', 'Villamar', 'Intriago', 'Cedeño', 'Loor', 'Párraga', 'Macías', 'Alcívar', 'Vera', 'Quimí', 'Tomalá', 'Reyes', 'Salazar', 'Calderón', 'Naranjo', 'Chávez', 'Andrade', 'Pazmiño', 'Yánez', 'Villacís', 'Espinoza', 'Mora', 'Burgos', 'Franco', 'Ponce', 'Bravo', 'Barzola', 'Morán', 'Suárez', 'Cabrera', 'Guerrero', 'Herrera', 'Jiménez', 'Lara', 'Moreno', 'Ortiz', 'Paredes', 'Rivera', 'Torres', 'Zúñiga', 'Ochoa', 'Briones', 'Delgado', 'Escobar'];
const MAIL = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
const NOTES = ['Prefiere que le escriban por la tarde.', 'Cliente desde la inauguración.', 'Suele venir con su familia.', 'Pide factura con datos.'];

/** Peso por hora del día (0 a 23) y por día de la semana (0 = domingo). */
const hoursOf = (pairs: [number, number][]): number[] => { const w = Array(24).fill(0); for (const [h, v] of pairs) w[h] = v; return w; };
const HOURS: Record<string, number[]> = {
  cafeteria: hoursOf([[7, .8], [8, 1], [9, .9], [10, .5], [11, .3], [12, .4], [13, .4], [14, .3], [15, .5], [16, .6], [17, .6], [18, .4], [19, .15]]),
  gimnasio: hoursOf([[5, .3], [6, 1], [7, .7], [8, .4], [9, .25], [10, .2], [12, .3], [13, .2], [16, .4], [17, .7], [18, 1], [19, .8], [20, .4]]),
  restaurante: hoursOf([[12, .7], [13, 1], [14, .7], [15, .2], [19, .5], [20, .9], [21, .7], [22, .2]]),
  floristeria: hoursOf([[9, .4], [10, .7], [11, .8], [12, .6], [14, .5], [15, .7], [16, .8], [17, .6], [18, .3]]),
  barberia: hoursOf([[10, .5], [11, .7], [12, .5], [14, .6], [15, .8], [16, .9], [17, .9], [18, .8], [19, .5]])
};
const WEEKDAYS: Record<string, number[]> = {
  cafeteria: [.9, .8, .9, .9, 1, 1.1, 1.3],
  gimnasio: [.4, 1.1, 1.1, 1, 1.1, .9, .6],
  restaurante: [1.1, .5, .6, .7, .9, 1.4, 1.5],
  floristeria: [1.1, .6, .7, .7, .9, 1.3, 1.5],
  barberia: [.4, .4, .7, .9, 1, 1.5, 1.5]
};

interface StaffCfg { key: string; name: string; role: Role; loc?: number }
interface BizCfg {
  id: string; name: string; type: BusinessType; city: string; seed: number;
  locations: { name: string; address: string }[];
  staff: StaffCfg[];
  customers: number; ready: number; voids: number; approvals: number;
  /** Frecuencia de visita de un cliente fiel: días entre visitas [mín, máx]. */
  loyal: [number, number];
  /** Probabilidad de que una visita sea un grupo. */
  party: number; maxCompanions: number;
  ticketPrefix: string; ticketStart: number;
  pedro?: boolean;
}

const BIZ: BizCfg[] = [
  {
    id: 'biz_esquina', name: 'Café La Esquina', type: 'cafeteria', city: 'Guayaquil', seed: 1101,
    locations: [{ name: 'Principal', address: 'Av. Víctor Emilio Estrada 1020 y Ebanos, Urdesa' }, { name: 'Mall del Sol', address: 'Av. Juan Tanca Marengo, local 214' }],
    staff: [
      { key: 'andrea', name: 'Andrea Zambrano', role: 'owner' }, { key: 'ricardo', name: 'Ricardo Vera', role: 'manager' },
      { key: 'pedro', name: 'Pedro', role: 'cashier', loc: 0 }, { key: 'marco', name: 'Marco', role: 'cashier', loc: 1 }, { key: 'lucia', name: 'Lucía', role: 'cashier', loc: 0 }
    ],
    customers: 62, ready: 3, voids: 5, approvals: 3, loyal: [2, 5], party: 0.12, maxCompanions: 3, ticketPrefix: 'T-', ticketStart: 4200, pedro: true
  },
  {
    id: 'biz_pulso', name: 'Gimnasio Pulso', type: 'gimnasio', city: 'Guayaquil', seed: 2202,
    locations: [{ name: 'Sede Kennedy', address: 'Av. del Periodista y Calle 5ta, Kennedy' }],
    staff: [
      { key: 'fernando', name: 'Fernando Cedeño', role: 'owner' }, { key: 'gabriela', name: 'Gabriela Mora', role: 'manager' },
      { key: 'kevin', name: 'Kevin Loor', role: 'cashier' }, { key: 'sofia', name: 'Sofía Paredes', role: 'cashier' }
    ],
    customers: 58, ready: 3, voids: 3, approvals: 1, loyal: [1, 3], party: 0.05, maxCompanions: 2, ticketPrefix: 'F-', ticketStart: 9100
  },
  {
    id: 'biz_petalo', name: 'Floristería Pétalo', type: 'floristeria', city: 'Quito', seed: 3303,
    locations: [{ name: 'Local La Floresta', address: 'Av. Coruña N24-30 y Whymper, La Floresta' }],
    staff: [
      { key: 'marcela', name: 'Marcela Intriago', role: 'owner' }, { key: 'paola', name: 'Paola Yépez', role: 'manager' },
      { key: 'daniela', name: 'Daniela Reyes', role: 'cashier' }, { key: 'joselyn', name: 'Joselyn Suárez', role: 'cashier' }
    ],
    customers: 40, ready: 2, voids: 3, approvals: 2, loyal: [7, 14], party: 0.05, maxCompanions: 2, ticketPrefix: 'FAC-', ticketStart: 1800
  },
  {
    id: 'biz_mesa', name: 'La Mesa de Ana', type: 'restaurante', city: 'Cuenca', seed: 4404,
    locations: [{ name: 'Centro Histórico', address: 'Calle Larga 7-35 y Hermano Miguel, Cuenca' }],
    staff: [
      { key: 'ana', name: 'Ana Pazmiño', role: 'owner' }, { key: 'luis', name: 'Luis Burgos', role: 'manager' },
      { key: 'carla', name: 'Carla Cevallos', role: 'cashier' }, { key: 'jorge', name: 'Jorge Macías', role: 'cashier' }
    ],
    customers: 52, ready: 2, voids: 3, approvals: 3, loyal: [4, 9], party: 0.35, maxCompanions: 4, ticketPrefix: 'C-', ticketStart: 7300
  },
  {
    id: 'biz_donlucho', name: 'Barbería Don Lucho', type: 'barberia', city: 'Guayaquil', seed: 5505,
    locations: [{ name: 'Principal', address: 'Cdla. Alborada, Mz. 12 Villa 4, Guayaquil' }],
    staff: [
      { key: 'luis', name: 'Luis Andrade', role: 'owner' }, { key: 'byron', name: 'Byron Quimí', role: 'manager' },
      { key: 'wilson', name: 'Wilson Zúñiga', role: 'cashier' }, { key: 'cristian', name: 'Cristian Loor', role: 'cashier' }
    ],
    customers: 46, ready: 2, voids: 3, approvals: 1, loyal: [4, 7], party: 0.05, maxCompanions: 2, ticketPrefix: 'T-', ticketStart: 2600
  }
];

/* ---------- Estructuras internas de la simulación ---------- */

type Seg = 'activo' | 'riesgo' | 'inactivo' | 'nuevo' | 'ready';
interface Plan { seg: Seg; createdAt: number; lastT: number; ready: boolean }
interface Ev { c: number; t: number; cur?: boolean }
interface Party { t: number; members: Ev[]; staffId: string; extraSeats: number; pedro?: boolean; approvedBy?: string }

const OFF = -300; // America/Guayaquil, sin horario de verano
const pad = (n: number, w: number) => String(n).padStart(w, '0');

export function buildSeed(now: number = Date.now()): SeedData {
  const out: SeedData = { businesses: [], locations: [], staff: [], programs: [], customers: [], codes: [], redemptions: [], audit: [], rejections: [] };
  for (const cfg of BIZ) buildBusiness(cfg, now, out);
  return out;
}

function buildBusiness(cfg: BizCfg, now: number, out: SeedData): void {
  const rng = new Rng(cfg.seed);
  const short = cfg.id.replace('biz_', '');
  const tpl = getTemplate(cfg.type);
  const today0 = localDayStart(now, OFF);
  const hours = HOURS[cfg.type];
  const weekdayW = WEEKDAYS[cfg.type];
  const maxW = Math.max(...weekdayW);

  /* Negocio, sucursales, programa y equipo */
  const bizCreated = now - rng.int(120, 300) * DAY_MS;
  out.businesses.push({
    id: cfg.id, name: cfg.name, slug: foldText(cfg.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), type: cfg.type, city: cfg.city,
    country: 'EC', currency: 'USD', timezone: 'America/Guayaquil', plan: cfg.id === 'biz_esquina' ? 'standard' : 'basico',
    createdAt: new Date(bizCreated).toISOString()
  });
  const locs: Location[] = cfg.locations.map((l, i) => ({ id: `loc_${short}_${i + 1}`, businessId: cfg.id, name: l.name, address: l.address, active: true }));
  out.locations.push(...locs);
  const program: Program = {
    businessId: cfg.id, ...tpl.program, logoText: initials(cfg.name),
    terms: 'Un sello por visita registrada en caja. El premio no es canjeable por dinero ni acumulable con otras promociones.',
    rewardExpiresDays: 60
  };
  out.programs.push(program);

  const staff: SeedStaff[] = cfg.staff.map((s) => ({
    id: `emp_${short}_${s.key}`, businessId: cfg.id, name: s.name, role: s.role, active: true,
    locationId: s.loc !== undefined ? locs[s.loc]?.id : undefined, hasPin: true,
    email: `${foldText(s.name.split(' ')[0])}@${short}.demo`,
    createdAt: new Date(s.key === 'pedro' ? now - 27 * DAY_MS : bizCreated + rng.int(1, 5) * 3_600_000).toISOString(),
    pin: DEMO_PINS[s.role === 'owner' ? 'owner' : s.role === 'manager' ? 'manager' : 'cashier']
  }));
  out.staff.push(...staff);
  const owner = staff.find((s) => s.role === 'owner')!;
  const manager = staff.find((s) => s.role === 'manager')!;
  const cashiers = staff.filter((s) => s.role === 'cashier');
  const pedro = cfg.pedro ? staff.find((s) => s.name === 'Pedro') : undefined;
  const organicCashiers = cashiers.filter((s) => s !== pedro);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const approverOf = () => (rng.chance(0.5) ? manager : owner);

  /* Parámetros de tiempo */
  const cooldownMs = program.cooldownMinutes * 60_000;
  const minGapDays = program.cooldownMinutes > 0 ? Math.ceil(program.cooldownMinutes / 1440) + (program.cooldownMinutes >= 1440 ? 1 : 0) : 1;
  const evGapMs = Math.max(3 * 3_600_000, cooldownMs + 3_600_000);
  const sampleHour = () => rng.weighted(hours);
  const timeAt = (dayOffset: number) => {
    const h = sampleHour();
    let t = today0 - dayOffset * DAY_MS + h * 3_600_000 + rng.int(0, 59) * 60_000 + rng.int(0, 59) * 1000;
    if (t > now - 15 * 60_000) t -= DAY_MS;
    return t;
  };
  const weekdayOf = (dayOffset: number) => localParts(today0 - dayOffset * DAY_MS + 12 * 3_600_000, OFF).wd;

  /* Clientes: nombres únicos, contacto, segmento objetivo */
  const n = cfg.customers;
  const segs: Seg[] = [
    ...Array(cfg.ready).fill('ready'), ...Array(Math.round(n * 0.14)).fill('nuevo'),
    ...Array(Math.round(n * 0.15)).fill('riesgo'), ...Array(Math.round(n * 0.2)).fill('inactivo')
  ];
  while (segs.length < n) segs.push('activo');
  const segOrder = rng.shuffle(segs.slice(0, n));

  const usedNames = new Set<string>();
  const usedContacts = new Set<string>();
  const customers: Customer[] = [];
  const plans: Plan[] = [];
  const times: number[][] = [];
  const [loLoyal, hiLoyal] = cfg.loyal;

  for (let i = 0; i < n; i++) {
    const seg = segOrder[i];
    let first: string; let last: string; let name: string;
    do { first = rng.pick(rng.chance(0.55) ? FEMALE : MALE); last = rng.pick(SURNAMES); name = `${first} ${last}`; } while (usedNames.has(name));
    usedNames.add(name);
    let contact: string; let kind: 'whatsapp' | 'email';
    do {
      if (rng.chance(0.7)) { kind = 'whatsapp'; contact = `09${rng.int(3, 9)}${pad(rng.int(0, 9_999_999), 7)}`; }
      else { kind = 'email'; contact = `${foldText(first)}.${foldText(last)}${rng.int(1, 99)}@${rng.pick(MAIL)}`; }
    } while (usedContacts.has(contact));
    usedContacts.add(contact);

    /* Días (hacia atrás) de cada visita */
    const persona = seg === 'ready' ? 'loyal' : seg === 'activo' ? rng.pick(['loyal', 'loyal', 'loyal', 'regular', 'regular', 'regular', 'regular', 'occasional']) : seg === 'riesgo' ? rng.pick(['regular', 'occasional']) : rng.pick(['regular', 'occasional', 'occasional']);
    const mult = persona === 'loyal' ? 1 : persona === 'regular' ? 2 : 3.5;
    const gap = () => Math.max(minGapDays, Math.round(rng.int(loLoyal, hiLoyal) * mult));
    const firstOff = seg === 'activo' ? rng.int(0, 18) : seg === 'riesgo' ? rng.int(23, 43) : seg === 'inactivo' ? rng.int(47, 84) : seg === 'nuevo' ? rng.int(0, 6) : rng.int(0, 10);
    const offs = [firstOff];
    if (seg === 'nuevo') {
      const k = rng.int(1, 3);
      while (offs.length < k) { const nx = offs[offs.length - 1] + rng.int(Math.max(1, minGapDays), 4); if (nx > 11) break; offs.push(nx); }
    } else if (seg === 'ready') {
      for (let k = 1; k < program.stampsRequired; k++) offs.push(offs[k - 1] + Math.max(minGapDays, rng.int(loLoyal, hiLoyal)));
    } else {
      const want = seg === 'activo' ? rng.int(5, 12) : seg === 'riesgo' ? rng.int(3, 7) : rng.int(2, 6);
      for (;;) {
        const lastOff = offs[offs.length - 1];
        let nx = lastOff + gap();
        // Sesgo por día de la semana: si el día pesa poco, se corre uno hacia un lado (siempre consume el mismo azar).
        const lowDay = rng.next() * maxW > weekdayW[weekdayOf(nx)];
        const dir = rng.chance(0.5) ? 1 : -1;
        if (lowDay) nx += dir;
        nx = Math.max(nx, lastOff + minGapDays);
        if (nx > 88 || offs.length >= 40) break;
        offs.push(nx);
        if (offs.length >= want && (seg !== 'activo' || nx >= 16)) break;
      }
    }
    const ts = offs.map((o) => timeAt(o)).sort((a, b) => a - b);
    let createdAt = ts[0] - rng.int(2, 40) * 60_000;
    if (seg !== 'nuevo') {
      createdAt = Math.min(createdAt, today0 - (15 + rng.int(0, 6)) * DAY_MS);
      if (seg !== 'ready' && rng.chance(0.4)) createdAt -= rng.int(10, 120) * DAY_MS; // ya existía antes de la ventana de 90 días
    }
    plans.push({ seg, createdAt, lastT: ts[ts.length - 1], ready: seg === 'ready' });
    times.push(ts);
    customers.push({
      id: `cli_${short}_${pad(i + 1, 3)}`, businessId: cfg.id, name, contact, contactKind: kind!,
      consentAt: new Date(createdAt).toISOString(), createdAt: new Date(createdAt).toISOString(),
      stamps: 0, totalStamps: 0, rewardsRedeemed: 0,
      wallet: rng.pick([undefined, 'apple', 'google', 'google'] as const),
      notes: rng.chance(0.06) ? rng.pick(NOTES) : undefined
    });
  }

  /* Cumpleaños: algunos en los próximos 30 días y el resto repartido en el año */
  const order = rng.shuffle(customers.map((_, i) => i));
  const upcoming = Math.min(9, Math.round(n * 0.15));
  order.forEach((ci, k) => {
    if (k < upcoming) {
      const p = localParts(today0 + rng.int(0, 29) * DAY_MS + 12 * 3_600_000, OFF);
      customers[ci].birthday = { d: p.d, m: p.m };
    } else if (rng.chance(0.78)) {
      customers[ci].birthday = { d: rng.int(1, 28), m: rng.int(0, 11) };
    }
  });

  /* Eventos y grupos */
  const evsOf: Ev[][] = customers.map(() => []);
  const parties: Party[] = [];
  const addParty = (t: number, members: Ev[], staffId: string, extra = 0, isPedro = false): Party => {
    const p: Party = { t, members, staffId, extraSeats: extra, pedro: isPedro };
    for (const m of members) evsOf[m.c].push(m);
    parties.push(p);
    return p;
  };
  const cashierWeights = organicCashiers.map(() => 1);
  const pickCashier = () => organicCashiers[rng.weighted(cashierWeights)];

  customers.forEach((_, c) => { for (const t of times[c]) addParty(t, [{ c, t }], '', 0); });

  const eligible = (c: number, t: number, strict: boolean) => {
    const pl = plans[c];
    if (pl.ready || t < Date.parse(customers[c].createdAt) + 60_000 || (strict && t > pl.lastT)) return false;
    const gapMs = strict ? evGapMs : 3_600_000;
    return evsOf[c].every((e) => Math.abs(e.t - t) >= gapMs);
  };
  const recruit = (party: Party, count: number, t0: number) => {
    const inParty = new Set(party.members.map((m) => m.c));
    for (const strict of [true, false]) {
      for (const c of rng.shuffle(customers.map((_, i) => i))) {
        if (count <= 0) break;
        if (inParty.has(c)) continue;
        const t = t0 + rng.int(10, 120) * 1000;
        if (!eligible(c, t, strict)) continue;
        const ev = { c, t };
        party.members.push(ev); evsOf[c].push(ev); inParty.add(c); count--;
      }
      if (count <= 0) break;
    }
  };

  /* Pedro: 9 tickets y 22 sellos, todos en los últimos 25 días (6 de ellos en la última semana) */
  if (pedro) {
    const sizes = [2, 3, 4, 2, 3, 2, 2, 2, 2];
    const days = [0, 1, 2, 3, 5, 6, 9, 14, 22];
    sizes.forEach((size, k) => {
      let t = today0 - days[k] * DAY_MS + rng.int(7, 11) * 3_600_000 + rng.int(0, 59) * 60_000;
      if (t > now - 15 * 60_000) t -= DAY_MS;
      const party = addParty(t, [], pedro.id, 0, true);
      recruit(party, size, t - 60_000);
      party.members.sort((a, b) => a.t - b.t);
      party.t = t;
    });
  }

  /* Grupos orgánicos */
  for (const p of [...parties].sort((a, b) => a.t - b.t)) {
    if (p.pedro || p.members.length !== 1) continue;
    if (!rng.chance(cfg.party)) continue;
    recruit(p, rng.int(1, cfg.maxCompanions), p.t);
  }

  /* Grupos grandes que exigen PIN (5 o 6 cupos), entre 8 y 28 días atrás */
  const bigCandidates = rng.shuffle(parties.filter((p) => !p.pedro && p.members.length <= 4 && p.t > now - 28 * DAY_MS && p.t < now - 8 * DAY_MS));
  for (const p of bigCandidates.slice(0, cfg.approvals)) {
    recruit(p, rng.int(5, 6) - p.members.length, p.t);
    if (p.members.length > program.maxSeatsWithoutApproval) p.approvedBy = approverOf().id;
  }

  for (const p of parties) {
    if (!p.staffId) p.staffId = pickCashier().id;
    p.members.sort((a, b) => a.t - b.t);
    p.t = p.members[0].t;
    if (!p.pedro && rng.chance(0.1)) p.extraSeats = 1;
    if (p.members.length > program.maxSeatsWithoutApproval && !p.approvedBy) p.approvedBy = approverOf().id;
  }

  /* Simulación por cliente: sellos, tarjetas completas y canjes */
  const redemptions: Redemption[] = [];
  customers.forEach((cu, c) => {
    const evs = evsOf[c].sort((a, b) => a.t - b.t);
    let stamps = 0; let total = 0; let redeemed = 0; let cycle: Ev[] = [];
    evs.forEach((ev, i) => {
      stamps++; total++; cycle.push(ev);
      if (stamps >= program.stampsRequired && !plans[c].ready) {
        const next = evs[i + 1]?.t ?? Infinity;
        let rt = ev.t + rng.int(10, 20 * 60) * 60_000;
        rt = Math.min(rt, next - 30 * 60_000, now - 5 * 60_000);
        if (rt <= ev.t) rt = ev.t + 60_000;
        const by = rng.pick([...organicCashiers, manager, owner]);
        redemptions.push({ id: `can_${short}_${pad(redemptions.length + 1, 3)}`, businessId: cfg.id, customerId: cu.id, customerName: cu.name, staffId: by.id, at: new Date(rt).toISOString() });
        for (const e of cycle) e.cur = false;
        cycle = []; stamps = 0; redeemed++;
      }
    });
    for (const e of cycle) e.cur = true;
    cu.stamps = stamps; cu.totalStamps = total; cu.rewardsRedeemed = redeemed;
  });

  /* Anulaciones: sellos del ciclo actual, de los últimos 25 días, que no sean de Pedro */
  const voidCandidates: { ev: Ev; party: Party }[] = [];
  for (const p of parties) {
    if (p.pedro) continue;
    for (const ev of p.members) if (ev.cur && !plans[ev.c].ready && ev.t > now - 25 * DAY_MS) voidCandidates.push({ ev, party: p });
  }
  const voided = new Map<Ev, { at: number; by: string }>();
  for (const { ev } of rng.shuffle(voidCandidates).slice(0, cfg.voids)) {
    voided.set(ev, { at: Math.min(ev.t + rng.int(3, 90) * 60_000, now - 60_000), by: approverOf().id });
  }
  for (const ev of voided.keys()) { customers[ev.c].stamps = Math.max(0, customers[ev.c].stamps - 1); customers[ev.c].totalStamps = Math.max(0, customers[ev.c].totalStamps - 1); }

  /* Códigos: cada grupo es un ticket; además códigos sueltos (vencidos sin usar, cancelados, uno activo ahora mismo) */
  interface Draft { createdAt: number; staffId: string; party?: Party; seats: number; cancelled?: boolean }
  const drafts: Draft[] = [];
  for (const p of parties) drafts.push({ createdAt: p.t - rng.int(20, 50) * 1000, staffId: p.staffId, party: p, seats: p.members.length + p.extraSeats });
  const extraStaff = () => (organicCashiers.length ? pickCashier() : cashiers[0]).id;
  for (let k = 0; k < 7; k++) drafts.push({ createdAt: timeAt(rng.int(1, 85)), staffId: extraStaff(), seats: rng.int(1, 3) });
  for (let k = 0; k < 3; k++) drafts.push({ createdAt: timeAt(rng.int(1, 28)), staffId: extraStaff(), seats: rng.int(1, 2), cancelled: true });
  drafts.push({ createdAt: now - 60_000, staffId: extraStaff(), seats: 2 });
  drafts.sort((a, b) => a.createdAt - b.createdAt);

  const codeSet = new Set<string>();
  const codes: StampCode[] = [];
  drafts.forEach((d, i) => {
    const code = generateCode(codeSet, () => rng.next());
    codeSet.add(code);
    const st = staffById.get(d.staffId)!;
    const amountCents = program.requireAmount
      ? roundTo5(d.seats * program.minSpendCentsPerStamp + rng.int(0, Math.floor(program.minSpendCentsPerStamp * (rng.chance(0.2) ? 1.9 : 0.9))))
      : 0;
    const id = `cod_${short}_${pad(i + 1, 4)}`;
    const claims: StampClaim[] = (d.party?.members ?? []).map((ev, k) => {
      const cl: StampClaim = { id: `clm_${short}_${pad(i + 1, 4)}_${k + 1}`, codeId: id, customerId: customers[ev.c].id, customerName: customers[ev.c].name, at: new Date(ev.t).toISOString() };
      const v = voided.get(ev);
      if (v) { cl.voidedAt = new Date(v.at).toISOString(); cl.voidedBy = v.by; }
      return cl;
    });
    codes.push({
      id, businessId: cfg.id, locationId: st.locationId ?? locs[0].id, code,
      ticket: `${cfg.ticketPrefix}${cfg.ticketStart + i}`, amountCents, seats: d.seats, createdBy: d.staffId,
      createdAt: new Date(d.createdAt).toISOString(), expiresAt: new Date(d.createdAt + program.codeTtlSeconds * 1000).toISOString(),
      approvedBy: d.party?.approvedBy, cancelledAt: d.cancelled ? new Date(d.createdAt + rng.int(20, 80) * 1000).toISOString() : undefined,
      attempts: 0, claims
    });
  });

  /* Intentos con códigos ya agotados (código compartido) */
  const rejections: Rejection[] = [];
  const rej = (r: Omit<Rejection, 'id' | 'businessId'>) => rejections.push({ id: `rej_${short}_${pad(rejections.length + 1, 3)}`, businessId: cfg.id, ...r });
  const full = codes.filter((c) => !c.cancelledAt && c.claims.length >= c.seats && c.claims.length >= 2 && !c.claims.some((cl) => cl.voidedAt));
  const recent = full.filter((c) => Date.parse(c.createdAt) > now - 10 * DAY_MS && !staffById.get(c.createdBy)?.name.startsWith('Pedro'));
  const older = full.filter((c) => Date.parse(c.createdAt) < now - 12 * DAY_MS && Date.parse(c.createdAt) > now - 35 * DAY_MS);
  const shared = [[recent.length ? rng.pick(recent) : full[full.length - 1], 3], [older.length ? rng.pick(older) : full[0], 1]] as const;
  for (const [code, attempts] of shared) {
    if (!code || code.attempts) continue;
    code.attempts = attempts;
    for (let k = 0; k < attempts; k++) rej({ kind: 'burned_code', codeId: code.id, at: new Date(Math.min(Date.parse(code.createdAt) + (6 + k * 11 + rng.int(0, 8)) * 60_000, now - 60_000)).toISOString() });
  }

  /* Tickets repetidos: Pedro 3 veces en el negocio demo; en los demás, uno o dos intentos de una cajera */
  const dupPlan: { staff: SeedStaff; days: number }[] = pedro
    ? [{ staff: pedro, days: 1 }, { staff: pedro, days: 4 }, { staff: pedro, days: 8 }, { staff: organicCashiers[0], days: 12 }]
    : [{ staff: cashiers[0], days: 5 }, { staff: cashiers[cashiers.length - 1], days: 16 }];
  for (const dp of dupPlan) {
    const at = now - dp.days * DAY_MS - rng.int(0, 8) * 3_600_000;
    const before = codes.filter((c) => Date.parse(c.createdAt) < at - 3_600_000);
    const target = before.length ? before[before.length - 1 - rng.int(0, Math.min(5, before.length - 1))] : codes[0];
    rej({ kind: 'duplicate_ticket', staffId: dp.staff.id, ticket: target.ticket, codeId: target.id, at: new Date(at).toISOString() });
  }

  /* Esperas entre sellos (solo programas con cooldown) */
  if (program.cooldownMinutes > 0) {
    const active = customers.filter((_, i) => plans[i].seg === 'activo');
    for (let k = 0; k < 4; k++) {
      const cu = rng.pick(active);
      rej({ kind: 'cooldown', customerId: cu.id, minutes: program.cooldownMinutes, at: new Date(now - rng.int(1, 14) * DAY_MS + rng.int(0, 10) * 3_600_000 - 5 * 3_600_000).toISOString() });
    }
  }

  /* Última visita = último sello no anulado; luego, bitácora */
  customers.forEach((cu, c) => {
    const kept = evsOf[c].filter((e) => !voided.has(e));
    const lastEv = kept.length ? kept[kept.length - 1] : evsOf[c][evsOf[c].length - 1];
    if (lastEv) cu.lastVisitAt = new Date(lastEv.t).toISOString();
  });

  const audit: AuditEntry[] = [];
  const log = (staffId: string | undefined, action: string, detail: string, at: number) =>
    audit.push({ id: `aud_${short}_${pad(audit.length + 1, 4)}`, businessId: cfg.id, staffId, action, detail, at: new Date(at).toISOString() });
  for (const s of staff.filter((x) => x.role !== 'owner')) log(owner.id, 'staff.update', `Se agregó a ${s.name} al equipo (${s.role === 'manager' ? 'gerente' : 'cajero'}).`, Date.parse(s.createdAt));
  log(owner.id, 'program.update', `Se ajustó la tarjeta: ${program.stampsRequired} sellos para ${program.rewardTitle.toLowerCase()}.`, now - 12 * DAY_MS);
  for (const c of codes) {
    const at = Date.parse(c.createdAt);
    if (at < now - 30 * DAY_MS) continue;
    log(c.createdBy, 'code.create', `Código ${c.code} para el ticket ${c.ticket}: ${cupos(c.seats)}${c.approvedBy ? `, aprobado por ${staffById.get(c.approvedBy)?.name}` : ''}.`, at);
    if (c.cancelledAt) log(c.createdBy, 'code.cancel', `Se canceló el código ${c.code} (ticket ${c.ticket}).`, Date.parse(c.cancelledAt));
    for (const cl of c.claims) if (cl.voidedAt) log(cl.voidedBy, 'claim.void', `Se anuló el sello de ${cl.customerName} (ticket ${c.ticket}).`, Date.parse(cl.voidedAt));
  }
  for (const r of redemptions) if (Date.parse(r.at) > now - 30 * DAY_MS) log(r.staffId, 'redeem', `Premio canjeado a ${r.customerName}: ${program.rewardTitle}.`, Date.parse(r.at));

  out.customers.push(...customers);
  out.codes.push(...codes);
  out.redemptions.push(...redemptions);
  out.audit.push(...audit);
  out.rejections.push(...rejections);
}

function roundTo5(cents: number): number { return Math.round(cents / 5) * 5; }
