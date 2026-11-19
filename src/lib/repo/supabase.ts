/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Alert, AuditEntry, Business, ClaimResult, CreateCodeResult, Customer, CustomerDetail, CustomerQuery, CustomerRow,
  DashboardData, Location, NewBusinessInput, NewStampCodeInput, Program, RangeKey, Redemption, Role, Staff,
  StaffReportRow, StampClaim, StampCode
} from '../contracts';
import { DAY_MS, initials, rangeDays, tzOffsetMinutes, validateBirthday, validateContact, validateName, validatePin, validateProgramPatch } from '../domain';
import {
  buildCustomerHistory, buildDashboard, buildStaffReport, deriveAlerts, filterCustomers,
  type AnalyticsInput, type Rejection
} from '../domain/analytics';
import { getTemplate } from '../templates';
import type { Repo } from './index';

/**
 * Repositorio de producción sobre Supabase (Postgres). Mismo contrato que memory.ts.
 *
 * CÓMO ACTIVARLO (no está conectado todavía en getRepo; lo hace el integrador):
 *   1. Aplicar supabase/migrations/0001_schema.sql y 0002_functions.sql (ver supabase/README.md).
 *   2. Variables de entorno de servidor: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, y STAMPA_REPO=supabase.
 *   3. En src/lib/repo/index.ts:
 *        g.__stampaRepo = process.env.STAMPA_REPO === 'supabase' ? createSupabaseRepo() : createMemoryRepo();
 *
 * Diseño:
 *   - Usa la service role (salta RLS), así que SOLO debe ejecutarse en servidor. Cada método filtra por business_id.
 *   - Las operaciones atómicas (crear código, reclamar, anular, cancelar, canjear, crear negocio) son funciones RPC de Postgres
 *     con las mismas reglas y mensajes que src/lib/domain. Devuelven jsonb {ok, error, field}.
 *   - La analítica trae filas acotadas por fecha y agrega en TypeScript con src/lib/domain/analytics (idéntico al repo en memoria).
 */

type Row = Record<string, any>;
const PAGE = 1000;

export function createSupabaseRepo(): Repo {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para usar el repositorio de Supabase.');
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  /* ---------- Utilidades ---------- */

  const must = <T>(res: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res.data as T;
  };
  const iso = (v: string | null | undefined): string | undefined => (v ? new Date(v).toISOString() : undefined);
  const nn = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

  /** Trae todas las filas de una consulta paginando de a 1000 (límite por defecto de PostgREST). */
  async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>, what: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = must(await build(from, from + PAGE - 1), what) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  /** Ejecuta una función RPC que devuelve {ok:false,error} en caso de regla de negocio. */
  async function rpc(fn: string, args: Record<string, unknown>): Promise<Row> {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(error.message);
    return (data ?? {}) as Row;
  }
  const rpcOrThrow = async (fn: string, args: Record<string, unknown>): Promise<Row> => {
    const r = await rpc(fn, args);
    if (r.ok === false) throw new Error(r.error ?? 'No se pudo completar la operación.');
    return r;
  };

  /* ---------- Mapeos fila -> contrato ---------- */

  const toBusiness = (r: Row): Business => ({
    id: r.id, name: r.name, slug: r.slug, type: r.type, city: nn(r.city), country: r.country, currency: 'USD',
    timezone: r.timezone, plan: r.plan, createdAt: iso(r.created_at)!
  });
  const toLocation = (r: Row): Location => ({ id: r.id, businessId: r.business_id, name: r.name, address: nn(r.address), active: r.active });
  const toStaff = (r: Row): Staff => ({
    id: r.id, businessId: r.business_id, name: r.name, role: r.role, active: r.active, locationId: nn(r.location_id),
    hasPin: !!r.has_pin, createdAt: iso(r.created_at)!
  });
  const toProgram = (r: Row): Program => ({
    businessId: r.business_id, name: r.name, stampsRequired: r.stamps_required, rewardTitle: r.reward_title,
    rewardDescription: nn(r.reward_description), requireAmount: r.require_amount, minSpendCentsPerStamp: r.min_spend_cents_per_stamp,
    codeTtlSeconds: r.code_ttl_seconds, maxSeatsWithoutApproval: r.max_seats_without_approval, cooldownMinutes: r.cooldown_minutes,
    colors: r.colors, logoText: r.logo_text, logoUrl: nn(r.logo_url), terms: nn(r.terms), birthdayReward: nn(r.birthday_reward),
    rewardExpiresDays: nn(r.reward_expires_days)
  });
  const toCustomer = (r: Row): Customer => ({
    id: r.id, businessId: r.business_id, name: r.name, contact: r.contact, contactKind: r.contact_kind,
    birthday: r.birthday_d != null && r.birthday_m != null ? { d: r.birthday_d, m: r.birthday_m } : undefined,
    consentAt: iso(r.consent_at)!, createdAt: iso(r.created_at)!, stamps: r.stamps, totalStamps: r.total_stamps,
    rewardsRedeemed: r.rewards_redeemed, lastVisitAt: iso(r.last_visit_at), wallet: nn(r.wallet), notes: nn(r.notes)
  });
  const toClaim = (r: Row): StampClaim => ({
    id: r.id, codeId: r.code_id, customerId: r.customer_id, customerName: r.customer_name, at: iso(r.at)!,
    voidedAt: iso(r.voided_at), voidedBy: nn(r.voided_by)
  });
  const toCode = (r: Row): StampCode => ({
    id: r.id, businessId: r.business_id, locationId: nn(r.location_id), code: r.code, ticket: r.ticket, amountCents: r.amount_cents,
    seats: r.seats, createdBy: r.created_by, createdAt: iso(r.created_at)!, expiresAt: iso(r.expires_at)!,
    approvedBy: nn(r.approved_by), cancelledAt: iso(r.cancelled_at), attempts: r.attempts,
    claims: ((r.stamp_claims ?? []) as Row[]).map(toClaim).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  });
  const toRedemption = (r: Row): Redemption => ({
    id: r.id, businessId: r.business_id, customerId: r.customer_id, customerName: r.customer_name, staffId: r.staff_id, at: iso(r.at)!
  });
  const toAudit = (r: Row): AuditEntry => ({ id: r.id, businessId: r.business_id, staffId: nn(r.staff_id), action: r.action, detail: r.detail, at: iso(r.at)! });
  const toRejection = (r: Row): Rejection => ({
    id: r.id, businessId: r.business_id, kind: r.kind, at: iso(r.at)!, staffId: nn(r.staff_id), codeId: nn(r.code_id),
    customerId: nn(r.customer_id), ticket: nn(r.ticket), minutes: nn(r.minutes)
  });

  /* ---------- Lecturas reutilizadas ---------- */

  const CODE_SELECT = '*, stamp_claims(*)';
  const getBiz = async (id: string): Promise<Business> => {
    const row = must(await db.from('businesses').select('*').eq('id', id).maybeSingle(), 'Negocio');
    if (!row) throw new Error('No encontramos ese negocio.');
    return toBusiness(row);
  };
  const getProg = async (id: string): Promise<Program> => {
    const row = must(await db.from('programs').select('*').eq('business_id', id).maybeSingle(), 'Programa');
    if (!row) throw new Error('Ese negocio no tiene programa configurado.');
    return toProgram(row);
  };
  const listStaffRows = async (businessId: string): Promise<Staff[]> =>
    (must(await db.from('staff').select('id,business_id,name,role,active,location_id,has_pin,created_at').eq('business_id', businessId).order('created_at'), 'Equipo') as Row[]).map(toStaff);
  const getCode = async (businessId: string, id: string): Promise<StampCode | null> => {
    const row = must(await db.from('stamp_codes').select(CODE_SELECT).eq('business_id', businessId).eq('id', id).maybeSingle(), 'Código');
    return row ? toCode(row) : null;
  };
  const allCustomers = async (businessId: string): Promise<Customer[]> =>
    (await fetchAll((f, t) => db.from('customers').select('*').eq('business_id', businessId).order('id').range(f, t), 'Clientes')).map(toCustomer);

  /** Códigos (con reclamos) creados desde `sinceMs`. Los reclamos de un código viejo no se pierden: se filtra por código. */
  const codesSince = async (businessId: string, sinceMs: number): Promise<StampCode[]> =>
    (await fetchAll((f, t) => db.from('stamp_codes').select(CODE_SELECT).eq('business_id', businessId)
      .gte('created_at', new Date(sinceMs).toISOString()).order('created_at', { ascending: false }).range(f, t), 'Códigos')).map(toCode);

  const redemptionsSince = async (businessId: string, sinceMs: number): Promise<Redemption[]> =>
    (await fetchAll((f, t) => db.from('redemptions').select('*').eq('business_id', businessId)
      .gte('at', new Date(sinceMs).toISOString()).order('at', { ascending: false }).range(f, t), 'Canjes')).map(toRedemption);

  async function analytics(businessId: string, sinceMs: number): Promise<AnalyticsInput & { business: Business }> {
    const now = Date.now();
    const [business, customers, codes, redemptions, staff] = await Promise.all([
      getBiz(businessId), allCustomers(businessId), codesSince(businessId, sinceMs), redemptionsSince(businessId, sinceMs), listStaffRows(businessId)
    ]);
    return {
      business, now: new Date(now), offsetMin: tzOffsetMinutes(business.timezone, now), customers, codes, redemptions,
      staff: staff.map((s) => ({ id: s.id, name: s.name, active: s.active, role: s.role }))
    };
  }

  /* ---------- Implementación ---------- */

  const repo: Repo = {
    async listBusinesses() {
      return (must(await db.from('businesses').select('*').order('created_at'), 'Negocios') as Row[]).map(toBusiness);
    },
    async getBusiness(id) {
      const row = must(await db.from('businesses').select('*').eq('id', id).maybeSingle(), 'Negocio');
      return row ? toBusiness(row) : null;
    },

    async createBusiness(input: NewBusinessInput) {
      const tpl = getTemplate(input.type);
      const r = await rpcOrThrow('create_business', {
        p_name: input.name, p_type: input.type, p_city: input.city ?? null, p_owner_name: input.ownerName, p_owner_pin: input.ownerPin,
        p_program: tpl.program, p_logo_text: initials(input.name)
      });
      return { business: await getBiz(r.business_id), ownerId: r.owner_id as string };
    },

    async updateBusiness(id, patch) {
      const upd: Row = {};
      if (patch.name !== undefined) { if (patch.name.trim().length < 2) throw new Error('Escribe el nombre del negocio.'); upd.name = patch.name.trim(); }
      if (patch.city !== undefined) upd.city = patch.city.trim() || null;
      if (patch.timezone !== undefined) upd.timezone = patch.timezone;
      if (patch.type !== undefined) upd.type = patch.type;
      if (Object.keys(upd).length) must(await db.from('businesses').update(upd).eq('id', id).select('id').single(), 'Negocio');
      await db.from('audit_log').insert({ business_id: id, action: 'business.update', detail: 'Se actualizaron los datos del negocio.' });
      return getBiz(id);
    },

    async listLocations(businessId) {
      return (must(await db.from('locations').select('*').eq('business_id', businessId).order('name'), 'Sucursales') as Row[]).map(toLocation);
    },
    async upsertLocation(businessId, loc) {
      if (!loc.name?.trim()) throw new Error('Escribe el nombre de la sucursal.');
      const row: Row = { business_id: businessId, name: loc.name.trim() };
      if (loc.id) row.id = loc.id;
      if (loc.address !== undefined) row.address = loc.address;
      if (loc.active !== undefined) row.active = loc.active;
      return toLocation(must(await db.from('locations').upsert(row).select('*').single(), 'Sucursal'));
    },

    async listStaff(businessId) { return listStaffRows(businessId); },

    async upsertStaff(businessId, s: Partial<Staff> & { name: string; role: Role }, pin, actorId) {
      const nameErr = validateName(s.name);
      if (nameErr) throw new Error(nameErr);
      if (pin !== undefined) { const e = validatePin(pin); if (e) throw new Error(e); }
      const current = s.id ? (await listStaffRows(businessId)).find((x) => x.id === s.id) : undefined;
      if (current) {
        const active = s.active ?? current.active;
        if (current.role === 'owner' && current.active && (s.role !== 'owner' || !active)) {
          const others = (await listStaffRows(businessId)).filter((x) => x.role === 'owner' && x.active && x.id !== current.id);
          if (!others.length) throw new Error('El negocio debe tener al menos un dueño activo.');
        }
      }
      const row: Row = { business_id: businessId, name: s.name.trim(), role: s.role };
      if (s.id) row.id = s.id;
      if (s.active !== undefined) row.active = s.active;
      if ('locationId' in s) row.location_id = s.locationId ?? null;
      const saved = must(await db.from('staff').upsert(row).select('id').single(), 'Equipo') as Row;
      if (pin !== undefined) await rpcOrThrow('set_staff_pin', { p_business_id: businessId, p_staff_id: saved.id, p_pin: pin });
      const out = (await listStaffRows(businessId)).find((x) => x.id === saved.id)!;
      await db.from('audit_log').insert({
        business_id: businessId, staff_id: actorId ?? null, action: 'staff.update',
        detail: `${current ? 'Se actualizó a' : 'Se agregó a'} ${out.name} (${out.role === 'owner' ? 'dueño' : out.role === 'manager' ? 'gerente' : 'cajero'})${pin !== undefined ? ' con PIN nuevo' : ''}.`
      });
      return out;
    },

    async verifyStaffPin(businessId, staffId, pin) {
      const { data, error } = await db.rpc('verify_staff_pin', { p_business_id: businessId, p_staff_id: staffId, p_pin: pin });
      if (error) throw new Error(error.message);
      return data === true;
    },

    async getProgram(businessId) { return getProg(businessId); },
    async updateProgram(businessId, patch, actorId) {
      const err = validateProgramPatch(patch);
      if (err) throw new Error(err);
      const map: Record<string, string> = {
        name: 'name', stampsRequired: 'stamps_required', rewardTitle: 'reward_title', rewardDescription: 'reward_description',
        requireAmount: 'require_amount', minSpendCentsPerStamp: 'min_spend_cents_per_stamp', codeTtlSeconds: 'code_ttl_seconds',
        maxSeatsWithoutApproval: 'max_seats_without_approval', cooldownMinutes: 'cooldown_minutes', colors: 'colors',
        logoText: 'logo_text', logoUrl: 'logo_url', terms: 'terms', birthdayReward: 'birthday_reward', rewardExpiresDays: 'reward_expires_days'
      };
      const upd: Row = {};
      const changed: string[] = [];
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || !map[k]) continue;
        upd[map[k]] = v; changed.push(k);
      }
      if (changed.length) must(await db.from('programs').update(upd).eq('business_id', businessId).select('business_id').single(), 'Programa');
      await db.from('audit_log').insert({ business_id: businessId, staff_id: actorId ?? null, action: 'program.update', detail: `Se actualizó la tarjeta (${changed.join(', ')}).` });
      return getProg(businessId);
    },

    async listCustomers(businessId, q?: CustomerQuery): Promise<CustomerRow[]> {
      const [customers, program] = await Promise.all([allCustomers(businessId), getProg(businessId)]);
      return filterCustomers(customers, program, q, new Date());
    },

    async getCustomerDetail(businessId, customerId): Promise<CustomerDetail | null> {
      const row = must(await db.from('customers').select('*').eq('business_id', businessId).eq('id', customerId).maybeSingle(), 'Cliente');
      if (!row) return null;
      const [program, staff, claims, reds] = await Promise.all([
        getProg(businessId), listStaffRows(businessId),
        fetchAll((f, t) => db.from('stamp_claims').select('*, stamp_codes(ticket, created_by)').eq('business_id', businessId).eq('customer_id', customerId).range(f, t), 'Sellos'),
        fetchAll((f, t) => db.from('redemptions').select('*').eq('business_id', businessId).eq('customer_id', customerId).range(f, t), 'Canjes')
      ]);
      const name = (id?: string | null) => staff.find((s) => s.id === id)?.name;
      const customer = filterCustomers([toCustomer(row)], program, undefined, new Date())[0];
      return {
        customer,
        history: buildCustomerHistory({
          claims: claims.map((c) => ({ at: iso(c.at)!, voidedAt: iso(c.voided_at), ticket: c.stamp_codes?.ticket, staffName: name(c.stamp_codes?.created_by), voidedByName: name(c.voided_by) })),
          redemptions: reds.map((r) => ({ at: iso(r.at)!, staffName: name(r.staff_id) }))
        })
      };
    },

    async updateCustomer(businessId, customerId, patch) {
      const cur = must(await db.from('customers').select('*').eq('business_id', businessId).eq('id', customerId).maybeSingle(), 'Cliente') as Row | null;
      if (!cur) throw new Error('No encontramos a ese cliente.');
      const upd: Row = {};
      if (patch.name !== undefined) { const e = validateName(patch.name); if (e) throw new Error(e); upd.name = patch.name.trim(); }
      if (patch.contact !== undefined) {
        const v = validateContact(cur.contact_kind, patch.contact);
        if (!v.ok) throw new Error(v.error);
        upd.contact = v.contact;
      }
      if ('notes' in patch) upd.notes = patch.notes?.trim() || null;
      if ('birthday' in patch) { const e = validateBirthday(patch.birthday); if (e) throw new Error(e); upd.birthday_d = patch.birthday?.d ?? null; upd.birthday_m = patch.birthday?.m ?? null; }
      const res = await db.from('customers').update(upd).eq('business_id', businessId).eq('id', customerId).select('*').single();
      if (res.error?.code === '23505') throw new Error('Ya existe un cliente con ese contacto.');
      return toCustomer(must(res, 'Cliente'));
    },

    async registerCustomer(businessId, c) {
      const nameErr = validateName(c.name);
      if (nameErr) throw new Error(nameErr);
      const v = validateContact(c.contactKind, c.contact);
      if (!v.ok) throw new Error(v.error);
      const bErr = validateBirthday(c.birthday);
      if (bErr) throw new Error(bErr);
      const res = await db.from('customers').insert({
        business_id: businessId, name: c.name.trim(), contact: v.contact, contact_kind: c.contactKind,
        birthday_d: c.birthday?.d ?? null, birthday_m: c.birthday?.m ?? null
      }).select('*').single();
      if (res.error?.code === '23505') throw new Error('Ya existe un cliente con ese contacto.');
      return toCustomer(must(res, 'Cliente'));
    },

    async createStampCode(businessId, input: NewStampCodeInput): Promise<CreateCodeResult> {
      const r = await rpc('create_stamp_code', {
        p_business_id: businessId, p_staff_id: input.staffId, p_location_id: input.locationId ?? null, p_ticket: input.ticket ?? '',
        p_amount_cents: Number.isFinite(input.amountCents) ? Math.trunc(input.amountCents) : null,
        p_seats: Number.isFinite(input.seats) ? Math.trunc(input.seats) : null, p_approval_pin: input.approvalPin ?? null
      });
      if (!r.ok) return { ok: false, error: r.error, ...(r.field ? { field: r.field } : {}) };
      const code = await getCode(businessId, r.code_id);
      if (!code) return { ok: false, error: 'No se pudo leer el código recién creado.' };
      return { ok: true, code };
    },

    async getStampCode(businessId, id) { return getCode(businessId, id); },

    async listStampCodes(businessId, limit = 50) {
      const rows = must(await db.from('stamp_codes').select(CODE_SELECT).eq('business_id', businessId).order('created_at', { ascending: false }).limit(limit), 'Códigos') as Row[];
      return rows.map(toCode);
    },

    async cancelStampCode(businessId, id, staffId) {
      await rpcOrThrow('cancel_stamp_code', { p_business_id: businessId, p_code_id: id, p_staff_id: staffId });
    },

    async claimStampCode(businessId, code, customerId): Promise<ClaimResult> {
      const r = await rpc('claim_stamp_code', { p_business_id: businessId, p_code: code, p_customer_id: customerId });
      if (!r.ok) return { ok: false, error: r.error };
      const [stamp, cust] = await Promise.all([
        getCode(businessId, r.code_id),
        db.from('customers').select('*').eq('id', customerId).single()
      ]);
      return { ok: true, code: stamp!, customer: toCustomer(must(cust, 'Cliente')), rewardReady: !!r.reward_ready };
    },

    async voidClaim(businessId, codeId, claimId, staffId) {
      await rpcOrThrow('void_claim', { p_business_id: businessId, p_code_id: codeId, p_claim_id: claimId, p_staff_id: staffId });
    },

    async listRedeemable(businessId) { return (await repo.listCustomers(businessId, { segment: 'por_canjear' })); },

    async redeemReward(businessId, customerId, staffId) {
      const r = await rpcOrThrow('redeem_reward', { p_business_id: businessId, p_customer_id: customerId, p_staff_id: staffId });
      return toRedemption(must(await db.from('redemptions').select('*').eq('id', r.redemption_id).single(), 'Canje'));
    },

    async listRedemptions(businessId, limit = 50) {
      const rows = must(await db.from('redemptions').select('*').eq('business_id', businessId).order('at', { ascending: false }).limit(limit), 'Canjes') as Row[];
      return rows.map(toRedemption);
    },

    async getDashboard(businessId, range: RangeKey): Promise<DashboardData> {
      // Periodo actual + anterior (mismo largo) + margen de un día por la zona horaria.
      const a = await analytics(businessId, Date.now() - (2 * rangeDays(range) + 1) * DAY_MS);
      return buildDashboard(range, a);
    },

    async getStaffReport(businessId, range: RangeKey): Promise<StaffReportRow[]> {
      return buildStaffReport(range, await analytics(businessId, Date.now() - (rangeDays(range) + 1) * DAY_MS));
    },

    async listAlerts(businessId, limit = 50): Promise<Alert[]> {
      const a = await analytics(businessId, Date.now() - 61 * DAY_MS);
      const [program, rej] = await Promise.all([
        getProg(businessId),
        fetchAll((f, t) => db.from('rejections').select('*').eq('business_id', businessId)
          .gte('at', new Date(Date.now() - 61 * DAY_MS).toISOString()).order('at', { ascending: false }).range(f, t), 'Rechazos')
      ]);
      return deriveAlerts(businessId, { ...a, program, rejections: rej.map(toRejection) }, limit);
    },

    async listAudit(businessId, limit = 50) {
      const rows = must(await db.from('audit_log').select('*').eq('business_id', businessId).order('at', { ascending: false }).limit(limit), 'Auditoría') as Row[];
      return rows.map(toAudit);
    }
  };

  return repo;
}
