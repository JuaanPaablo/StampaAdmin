import type {
  Alert, Customer, CustomerDetail, CustomerQuery, CustomerRow, DashboardData, Program, RangeKey,
  Redemption, Role, Staff, StaffReportRow, StampCode
} from '../contracts';
import { DAY_MS, dayKey, localParts, rangeBounds } from './dates';
import { flagStaff, segmentOf, teamMedianRatio } from './index';
import { cupos, foldText, num1 } from './text';

/**
 * Analítica pura sobre listas ya cargadas. memory.ts y supabase.ts traen las filas y llaman aquí,
 * así los dos repos calculan exactamente lo mismo.
 */

/** Intento rechazado. Es lo único que no se puede deducir de los códigos y reclamos. */
export interface Rejection {
  id: string;
  businessId: string;
  kind: 'duplicate_ticket' | 'cooldown' | 'burned_code';
  at: string;
  staffId?: string;
  codeId?: string;
  customerId?: string;
  ticket?: string;
  minutes?: number;      // espera configurada (cooldown)
}

export interface AnalyticsInput {
  now: Date;
  offsetMin: number;
  customers: Customer[];
  codes: StampCode[];
  redemptions: Redemption[];
  staff: (Pick<Staff, 'id' | 'name' | 'active'> & { role?: Role })[];
}

const inRange = (iso: string, s: number, e: number) => {
  const t = Date.parse(iso);
  return t >= s && t < e;
};

export function buildDashboard(range: RangeKey, d: AnalyticsInput): DashboardData {
  const now = d.now.getTime();
  const b = rangeBounds(range, now, d.offsetMin);

  const periodStats = (start: number, end: number) => {
    const perCustomer = new Map<string, number>();
    let stamps = 0;
    for (const code of d.codes) {
      for (const cl of code.claims) {
        if (cl.voidedAt || !inRange(cl.at, start, end)) continue;
        stamps++;
        perCustomer.set(cl.customerId, (perCustomer.get(cl.customerId) ?? 0) + 1);
      }
    }
    const tickets = d.codes.filter((c) => !c.cancelledAt && inRange(c.createdAt, start, end)).length;
    return {
      stamps, perCustomer, tickets,
      newCustomers: d.customers.filter((c) => inRange(c.createdAt, start, end)).length,
      redeemed: d.redemptions.filter((r) => inRange(r.at, start, end)).length
    };
  };

  const cur = periodStats(b.start, b.end);
  const prev = periodStats(b.prevStart, b.start);
  const returning = [...cur.perCustomer.values()].filter((n) => n >= 2).length;

  // Series diaria completa (rellena días sin actividad).
  const series: DashboardData['series'] = [];
  const idx = new Map<string, number>();
  for (let i = 0; i < b.days; i++) {
    const key = dayKey(b.start + i * DAY_MS + 12 * 3_600_000, d.offsetMin);
    idx.set(key, series.length);
    series.push({ date: key, stamps: 0, newCustomers: 0 });
  }
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, stamps: 0 }));
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, stamps: 0 }));
  for (const code of d.codes) {
    for (const cl of code.claims) {
      if (cl.voidedAt || !inRange(cl.at, b.start, b.end)) continue;
      const t = Date.parse(cl.at);
      const i = idx.get(dayKey(t, d.offsetMin));
      if (i !== undefined) series[i].stamps++;
      const p = localParts(t, d.offsetMin);
      byHour[p.h].stamps++;
      byWeekday[p.wd].stamps++;
    }
  }
  for (const c of d.customers) {
    if (!inRange(c.createdAt, b.start, b.end)) continue;
    const i = idx.get(dayKey(Date.parse(c.createdAt), d.offsetMin));
    if (i !== undefined) series[i].newCustomers++;
  }

  const names = new Map(d.customers.map((c) => [c.id, c.name]));
  const topCustomers = [...cur.perCustomer.entries()]
    .map(([customerId, stamps]) => ({ customerId, name: names.get(customerId) ?? 'Cliente', stamps }))
    .sort((a, b2) => b2.stamps - a.stamps || a.name.localeCompare(b2.name, 'es'))
    .slice(0, 5);

  return {
    range,
    kpis: {
      stampsIssued: cur.stamps,
      activeCustomers: cur.perCustomer.size,
      newCustomers: cur.newCustomers,
      rewardsRedeemed: cur.redeemed,
      returnRate: cur.perCustomer.size ? Math.round((returning / cur.perCustomer.size) * 1000) / 1000 : 0,
      stampsPerTicket: cur.tickets ? Math.round((cur.stamps / cur.tickets) * 100) / 100 : 0
    },
    previous: { stampsIssued: prev.stamps, activeCustomers: prev.perCustomer.size, newCustomers: prev.newCustomers, rewardsRedeemed: prev.redeemed },
    series, byHour, byWeekday, topCustomers,
    upcomingBirthdays: upcomingBirthdays(d.customers, d.now, d.offsetMin, 30, 10)
  };
}

/** Cumpleaños de los próximos `days` días (hoy incluido), del más cercano al más lejano. */
export function upcomingBirthdays(customers: Customer[], now: Date, offsetMin: number, days = 30, limit = 10) {
  const today = localParts(now, offsetMin);
  const todayUtc = Date.UTC(today.y, today.m, today.d);
  const out: { customerId: string; name: string; d: number; m: number; in: number }[] = [];
  for (const c of customers) {
    if (!c.birthday) continue;
    let next = Date.UTC(today.y, c.birthday.m, c.birthday.d);
    if (next < todayUtc) next = Date.UTC(today.y + 1, c.birthday.m, c.birthday.d);
    const diff = Math.round((next - todayUtc) / DAY_MS);
    if (diff <= days) out.push({ customerId: c.id, name: c.name, d: c.birthday.d, m: c.birthday.m, in: diff });
  }
  return out
    .sort((a, b) => a.in - b.in || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
    .map(({ customerId, name, d, m }) => ({ customerId, name, d, m }));
}

/**
 * Reporte por persona del equipo. Tickets = códigos creados en el rango y no cancelados; sellos = reclamos no anulados
 * de esos códigos; anulaciones = reclamos anulados de esos códigos. Entran los cajeros activos y quien tenga tickets.
 */
export function buildStaffReport(range: RangeKey, d: AnalyticsInput): StaffReportRow[] {
  const b = rangeBounds(range, d.now, d.offsetMin);
  const acc = new Map<string, { tickets: number; stamps: number; voids: number }>();
  for (const code of d.codes) {
    if (code.cancelledAt || !inRange(code.createdAt, b.start, b.end)) continue;
    const a = acc.get(code.createdBy) ?? { tickets: 0, stamps: 0, voids: 0 };
    a.tickets++;
    for (const cl of code.claims) cl.voidedAt ? a.voids++ : a.stamps++;
    acc.set(code.createdBy, a);
  }
  const rows: Omit<StaffReportRow, 'ratio' | 'flagged'>[] = [];
  for (const s of d.staff) {
    const a = acc.get(s.id);
    if (!a && !(s.active && s.role === 'cashier')) continue;
    rows.push({ staffId: s.id, name: s.name, tickets: a?.tickets ?? 0, stamps: a?.stamps ?? 0, voids: a?.voids ?? 0 });
  }
  rows.sort((x, y) => y.tickets - x.tickets || x.name.localeCompare(y.name, 'es'));
  return flagStaff(rows);
}

/**
 * Alertas DERIVADAS de los datos (no se guardan). Ventana: 30 días para el ratio del equipo y 60 para el resto.
 * Orden: más recientes primero.
 */
export function deriveAlerts(
  businessId: string,
  d: AnalyticsInput & { rejections: Rejection[]; program: Pick<Program, 'cooldownMinutes'> },
  limit = 50
): Alert[] {
  const now = d.now.getTime();
  const since60 = now - 60 * DAY_MS;
  const since30 = now - 30 * DAY_MS;
  const staffName = (id?: string) => d.staff.find((s) => s.id === id)?.name ?? 'Alguien del equipo';
  const out: Alert[] = [];

  // 1) Ratio sellos por ticket frente a la mediana del equipo.
  const report = buildStaffReport('30d', d);
  const med = teamMedianRatio(report);
  for (const r of report.filter((x) => x.flagged)) {
    const last = d.codes.filter((c) => c.createdBy === r.staffId && !c.cancelledAt).map((c) => Date.parse(c.createdAt)).sort((a, b) => b - a)[0] ?? now;
    out.push({
      id: `alr_ratio_${r.staffId}`, businessId, kind: 'staff_ratio', staffId: r.staffId, at: new Date(last).toISOString(),
      severity: r.ratio >= 2 * med ? 'critical' : 'warning',
      message: `${r.name} registra ${num1(r.ratio)} sellos por ticket y la mediana del equipo es ${num1(med)} (${r.tickets} tickets en 30 días). Conviene revisar sus tickets.`
    });
  }

  // 2) Códigos con intentos tras agotarse (posible código compartido) y 3) aprobaciones con PIN.
  const burned = new Map<string, number>();
  for (const r of d.rejections) {
    if (r.kind === 'burned_code' && r.codeId) burned.set(r.codeId, Math.max(burned.get(r.codeId) ?? 0, Date.parse(r.at)));
  }
  const voidsBy = new Map<string, { n: number; at: number }>();
  for (const c of d.codes) {
    const created = Date.parse(c.createdAt);
    if (c.attempts > 0 && created >= since60) {
      out.push({
        id: `alr_shared_${c.id}`, businessId, kind: 'shared_code', codeId: c.id, staffId: c.createdBy,
        at: new Date(burned.get(c.id) ?? Date.parse(c.expiresAt)).toISOString(),
        severity: c.attempts >= 3 ? 'critical' : 'warning',
        message: `El código ${c.code} (ticket ${c.ticket}) recibió ${c.attempts} ${c.attempts === 1 ? 'intento' : 'intentos'} después de agotarse. Puede estar circulando fuera del local.`
      });
    }
    if (c.approvedBy && created >= since60) {
      out.push({
        id: `alr_approval_${c.id}`, businessId, kind: 'approval', codeId: c.id, staffId: c.createdBy, at: c.createdAt, severity: 'info',
        message: `${staffName(c.createdBy)} generó ${cupos(c.seats)} para el ticket ${c.ticket} con aprobación de ${staffName(c.approvedBy)}.`
      });
    }
    for (const cl of c.claims) {
      if (!cl.voidedAt) continue;
      const t = Date.parse(cl.voidedAt);
      if (t < since30) continue;
      const v = voidsBy.get(c.createdBy) ?? { n: 0, at: 0 };
      v.n++; v.at = Math.max(v.at, t);
      voidsBy.set(c.createdBy, v);
    }
  }

  // 4) Anulaciones agrupadas por quien generó los códigos.
  for (const [staffId, v] of voidsBy) {
    out.push({
      id: `alr_voids_${staffId}`, businessId, kind: 'voids', staffId, at: new Date(v.at).toISOString(),
      severity: v.n >= 3 ? 'warning' : 'info',
      message: `${v.n} ${v.n === 1 ? 'sello anulado' : 'sellos anulados'} de tickets de ${staffName(staffId)} en los últimos 30 días.`
    });
  }

  // 5) Tickets repetidos y 6) esperas entre sellos, contados desde los rechazos.
  const dupByStaff = new Map<string, number>();
  for (const r of d.rejections) {
    if (r.kind === 'duplicate_ticket' && r.staffId && Date.parse(r.at) >= since30) dupByStaff.set(r.staffId, (dupByStaff.get(r.staffId) ?? 0) + 1);
  }
  const custName = new Map(d.customers.map((c) => [c.id, c.name]));
  for (const r of d.rejections) {
    if (Date.parse(r.at) < since60) continue;
    if (r.kind === 'duplicate_ticket') {
      const repeats = r.staffId ? dupByStaff.get(r.staffId) ?? 0 : 0;
      out.push({
        id: `alr_${r.id}`, businessId, kind: 'duplicate_ticket', staffId: r.staffId, codeId: r.codeId, at: r.at,
        severity: repeats >= 3 ? 'critical' : 'warning',
        message: `${staffName(r.staffId)} intentó registrar otra vez el ticket ${r.ticket ?? 'ya usado'}. Un ticket genera un solo código.` +
          (repeats >= 3 ? ` Ya van ${repeats} intentos repetidos en 30 días.` : '')
      });
    } else if (r.kind === 'cooldown') {
      const mins = r.minutes ?? d.program.cooldownMinutes;
      out.push({
        id: `alr_${r.id}`, businessId, kind: 'cooldown', at: r.at, severity: 'info', codeId: r.codeId,
        message: `${r.customerId ? custName.get(r.customerId) ?? 'Un cliente' : 'Un cliente'} intentó sumar un sello antes de cumplir la espera de ${mins} min.`
      });
    }
  }

  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/** Filtra, busca y ordena clientes; devuelve filas con segmento. */
export function filterCustomers(customers: Customer[], program: Pick<Program, 'stampsRequired'>, q: CustomerQuery | undefined, now: Date): CustomerRow[] {
  let rows: CustomerRow[] = customers.map((c) => ({ ...c, segment: segmentOf(c, program, now) }));
  const term = q?.search ? foldText(q.search.trim()) : '';
  if (term) rows = rows.filter((r) => foldText(r.name).includes(term) || foldText(r.contact).includes(term));
  if (q?.segment && q.segment !== 'todos') rows = rows.filter((r) => r.segment === q.segment);
  const seen = (r: Customer) => Date.parse(r.lastVisitAt ?? r.createdAt);
  switch (q?.sort ?? 'recientes') {
    case 'sellos': rows.sort((a, b) => b.stamps - a.stamps || b.totalStamps - a.totalStamps || a.name.localeCompare(b.name, 'es')); break;
    case 'nombre': rows.sort((a, b) => a.name.localeCompare(b.name, 'es')); break;
    case 'inactividad': rows.sort((a, b) => seen(a) - seen(b)); break;
    default: rows.sort((a, b) => seen(b) - seen(a)); // 'recientes': última visita más cercana primero
  }
  return rows;
}

/** Historial de un cliente: sellos, anulaciones y canjes, del más reciente al más antiguo. */
export function buildCustomerHistory(input: {
  claims: { at: string; voidedAt?: string; ticket?: string; staffName?: string; voidedByName?: string }[];
  redemptions: { at: string; staffName?: string }[];
}): CustomerDetail['history'] {
  const h: CustomerDetail['history'] = [];
  for (const c of input.claims) {
    h.push({ at: c.at, kind: 'stamp', ticket: c.ticket, staffName: c.staffName });
    if (c.voidedAt) h.push({ at: c.voidedAt, kind: 'void', ticket: c.ticket, staffName: c.voidedByName ?? c.staffName });
  }
  for (const r of input.redemptions) h.push({ at: r.at, kind: 'redeem', staffName: r.staffName });
  return h.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
