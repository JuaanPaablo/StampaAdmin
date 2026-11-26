/* eslint-disable @typescript-eslint/no-explicit-any */
import { newPhotoId, PHOTO_ID_RE, validateMarketingPhoto } from '../marketing/photos';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Alert, AuditEntry, Business, ClaimResult, CreateCodeResult, Customer, CustomerDetail, CustomerQuery, CustomerRow,
  DashboardData, Location, NewBusinessInput, NewStampCodeInput, Program, RangeKey, Redemption, Role, Staff,
  StaffReportRow, StampClaim, StampCode, MarketingGeneration, MarketingUsage
} from '../contracts';
import { DAY_MS, initials, rangeDays, slugify, tzOffsetMinutes, validateBirthday, validateContact, validateName, validatePin, validateProgramPatch } from '../domain';
import {
  buildCustomerHistory, buildDashboard, buildStaffReport, deriveAlerts, filterCustomers,
  type AnalyticsInput, type Rejection
} from '../domain/analytics';
import { getTemplate } from '../templates';
import { effectiveExpiry, maxLocations, maxStaff, staffLimitError } from '../plan-rules';
import { PLAN_LABEL, planOf } from '../plans';
import { normalizeEmail, validateEmail } from '../credentials';
import { hashPassword, validatePassword, verifyPassword } from '../password';
import { AttemptLimiter, LOCK_MS, MAX_FAILED_LOGINS } from '../login-throttle';
import type { Repo } from './index';
import type { AccessTokenInfo, AdminAccount, AdminBusinessRow, BusinessSetupInput, CustomerCard, IssuedToken, PlatformSummary } from '../contracts';
import type { AdminAction, AdminBusinessDetail, AdminPayment, AiUsage, NewPaymentInput } from '../contracts';
import {
  adminActionSummary, aiCostRow, buildAdminInsights, businessHealth, daysSince, ecDayKey, ecMonthStartIso, fillSeries,
  nextPlanExpiry, validatePayment
} from '../domain/admin-insights';
import { normalizeEcPhone } from '../phone';
import { INVITE_TTL_HOURS, RESET_TTL_MINUTES } from '../contracts';
import { generateOtp, generateToken, hashOtp, hashToken, isTokenShape } from '../tokens';
import {
  OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_TTL_MINUTES, PLACEHOLDER_BUSINESS_NAME, PLANS, provisionalSlug, validateBirthYear, validateBusinessImage
} from '../mvp-rules';

/**
 * Repositorio de producción sobre Supabase (Postgres). Mismo contrato que memory.ts.
 *
 * CÓMO ACTIVARLO (no está conectado todavía en getRepo; lo hace el integrador):
 *   1. Aplicar supabase/migrations/0001..0004 en orden (ver supabase/README.md).
 *   2. Variables de entorno de servidor: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, y STAMPA_REPO=supabase.
 *   3. En src/lib/repo/index.ts:
 *        g.__stampaRepo = process.env.STAMPA_REPO === 'supabase' ? createSupabaseRepo() : createMemoryRepo();
 *
 * Diseño:
 *   - Usa la service role (salta RLS), así que SOLO debe ejecutarse en servidor. Cada método filtra por business_id.
 *   - Las operaciones atómicas (crear código, reclamar, anular, cancelar, canjear, crear negocio) son funciones RPC de Postgres
 *     con las mismas reglas y mensajes que src/lib/domain. Devuelven jsonb {ok, error, field}.
 *   - MVP: alta de negocio + invitación, enlaces de un solo uso, correo del equipo y códigos de verificación también son
 *     funciones RPC (0004_mvp.sql). Tokens y códigos viajan a la base SOLO como hash (src/lib/tokens.ts).
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
    timezone: r.timezone, plan: planOf(r.plan), createdAt: iso(r.created_at)!,
    status: r.status ?? 'active', planExpiresAt: effectiveExpiry(iso(r.plan_expires_at), !!r.auto_renew), suspendedAt: iso(r.suspended_at),
    setupCompletedAt: iso(r.setup_completed_at), province: nn(r.province), autoRenew: !!r.auto_renew
  });
  const toLocation = (r: Row): Location => ({ id: r.id, businessId: r.business_id, name: r.name, address: nn(r.address), active: r.active });
  const toStaff = (r: Row): Staff => ({
    id: r.id, businessId: r.business_id, name: r.name, role: r.role, active: r.active, locationId: nn(r.location_id),
    email: nn(r.email), hasPin: !!r.has_pin, createdAt: iso(r.created_at)!, invitePending: !!r.email && !r.has_password
  });
  const toProgram = (r: Row): Program => ({
    businessId: r.business_id, name: r.name, stampsRequired: r.stamps_required, rewardTitle: r.reward_title,
    rewardDescription: nn(r.reward_description), requireAmount: r.require_amount, minSpendCentsPerStamp: r.min_spend_cents_per_stamp,
    codeTtlSeconds: r.code_ttl_seconds, maxSeatsWithoutApproval: r.max_seats_without_approval, cooldownMinutes: r.cooldown_minutes,
    colors: r.colors, logoText: r.logo_text, logoUrl: nn(r.logo_url), terms: nn(r.terms), birthdayReward: nn(r.birthday_reward),
    rewardExpiresDays: nn(r.reward_expires_days), coverUrl: nn(r.cover_url),
    milestones: Array.isArray(r.milestones) ? r.milestones : [], imageFraming: r.image_framing ?? {}, poster: r.poster ?? {}
  });
  const toCustomer = (r: Row): Customer => ({
    id: r.id, businessId: r.business_id, name: r.name, contact: r.contact, contactKind: r.contact_kind,
    birthday: r.birthday_d != null && r.birthday_m != null ? { d: r.birthday_d, m: r.birthday_m } : undefined,
    consentAt: iso(r.consent_at)!, createdAt: iso(r.created_at)!, stamps: r.stamps, totalStamps: r.total_stamps,
    rewardsRedeemed: r.rewards_redeemed, lastVisitAt: iso(r.last_visit_at), wallet: nn(r.wallet), notes: nn(r.notes),
    birthdayYear: nn(r.birthday_y), emailVerifiedAt: iso(r.email_verified_at), milestonesClaimed: r.milestones_claimed ?? []
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
  const toMarketing = (r: Row): MarketingGeneration => ({
    id: r.id, businessId: r.business_id, staffId: r.staff_id ?? undefined, kind: r.kind, topic: r.topic ?? undefined, output: r.output,
    model: r.model ?? undefined, promptTokens: Number(r.prompt_tokens) || 0, cachedTokens: Number(r.cached_tokens) || 0,
    completionTokens: Number(r.completion_tokens) || 0, createdAt: iso(r.created_at)!
  });

  const toRedemption = (r: Row): Redemption => ({
    id: r.id, businessId: r.business_id, customerId: r.customer_id, customerName: r.customer_name, staffId: r.staff_id, at: iso(r.at)!,
    milestone: nn(r.milestone), rewardTitle: nn(r.reward_title)
  });
  const toAudit = (r: Row): AuditEntry => ({ id: r.id, businessId: r.business_id, staffId: nn(r.staff_id), action: r.action, detail: r.detail, at: iso(r.at)! });
  const toRejection = (r: Row): Rejection => ({
    id: r.id, businessId: r.business_id, kind: r.kind, at: iso(r.at)!, staffId: nn(r.staff_id), codeId: nn(r.code_id),
    customerId: nn(r.customer_id), ticket: nn(r.ticket), minutes: nn(r.minutes)
  });

  /* ---------- Lecturas reutilizadas ---------- */

  const CODE_SELECT = '*, stamp_claims(*)';
  /** Columnas públicas del equipo: nunca password_hash ni pin_hash. */
  const STAFF_COLS = 'id,business_id,name,role,active,location_id,email,has_pin,has_password,created_at';
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
    (must(await db.from('staff').select(STAFF_COLS).eq('business_id', businessId).order('created_at'), 'Equipo') as Row[]).map(toStaff);
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

  /** Fallos de correos que no existen (por proceso): bloquean igual que una cuenta real para no revelar cuáles existen. */
  const unknownEmails = new AttemptLimiter(MAX_FAILED_LOGINS, LOCK_MS);

  async function authLookup(email: string): Promise<Row | null> {
    const { data, error } = await db.rpc('auth_lookup', { p_email: email });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  }

  /* ---------- Auxiliares del MVP ---------- */

  const DAY = 86_400_000;
  const fail = (msg: string): never => { throw new Error(msg); };
  const logAudit = async (businessId: string, staffId: string | null | undefined, action: string, detail: string) => {
    await db.from('audit_log').insert({ business_id: businessId, staff_id: staffId ?? null, action, detail });
  };
  const IMAGE_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

  /** Valores de la plantilla (templates.ts) como columnas de programs. */
  const templateProgramRow = (p: ReturnType<typeof getTemplate>['program']): Row => ({
    name: p.name, stamps_required: p.stampsRequired, reward_title: p.rewardTitle, reward_description: p.rewardDescription ?? null,
    require_amount: p.requireAmount, min_spend_cents_per_stamp: p.minSpendCentsPerStamp, code_ttl_seconds: p.codeTtlSeconds,
    max_seats_without_approval: p.maxSeatsWithoutApproval, cooldown_minutes: p.cooldownMinutes, colors: p.colors,
    birthday_reward: p.birthdayReward ?? null
  });

  const toAdmin = (r: Row): AdminAccount => ({ id: r.id, email: r.email, createdAt: iso(r.created_at)!, lastLoginAt: iso(r.last_login_at) });
  const adminLookup = async (email: string): Promise<Row | null> =>
    must(await db.from('platform_admins').select('id,email,password_hash,locked_until,created_at,last_login_at').eq('email', email).maybeSingle(), 'Administrador') as Row | null;
  /** Fallos de admins que no existen (por proceso): bloquean igual que una cuenta real. */
  const unknownAdmins = new AttemptLimiter(MAX_FAILED_LOGINS, LOCK_MS);

  /** Filas del panel de administrador (id = un solo negocio). */
  async function adminRows(id?: string): Promise<AdminBusinessRow[]> {
    const [bizRows, owners, stats] = await Promise.all([
      fetchAll((f, t) => {
        const q = db.from('businesses').select('*');
        return (id ? q.eq('id', id) : q).order('created_at', { ascending: false }).order('id').range(f, t);
      }, 'Negocios'),
      fetchAll((f, t) => {
        const q = db.from('staff').select(STAFF_COLS).eq('role', 'owner');
        return (id ? q.eq('business_id', id) : q).order('created_at').order('id').range(f, t);
      }, 'Dueños'),
      fetchAll((f, t) => db.rpc('admin_business_stats', { p_business_id: id ?? null }).range(f, t), 'Métricas')
    ]);
    const ownerOf = new Map<string, Staff>();
    for (const o of owners.map(toStaff)) if (!ownerOf.has(o.businessId)) ownerOf.set(o.businessId, o);   // el dueño más antiguo
    const statsOf = new Map(stats.map((s) => [s.biz_id as string, s]));
    // Vencimiento de la invitación vigente (sin usar) de los dueños que aún no crean su contraseña.
    const pendingIds = [...ownerOf.values()].filter((o) => o.invitePending).map((o) => o.id);
    const inviteOf = new Map<string, string>();
    for (let i = 0; i < pendingIds.length; i += 100) {
      const toks = must(await db.from('access_tokens').select('staff_id,expires_at').eq('kind', 'invite').is('used_at', null)
        .in('staff_id', pendingIds.slice(i, i + 100)), 'Invitaciones') as Row[];
      for (const t of toks) {
        const prev = inviteOf.get(t.staff_id);
        if (!prev || Date.parse(t.expires_at) > Date.parse(prev)) inviteOf.set(t.staff_id, iso(t.expires_at)!);
      }
    }
    return bizRows.map((r) => {
      const o = ownerOf.get(r.id);
      const s = statsOf.get(r.id);
      return {
        business: toBusiness(r),
        owner: o ? { staffId: o.id, name: o.name, email: o.email, invitePending: !!o.invitePending } : undefined,
        note: nn(r.admin_note) ?? undefined,
        stats: {
          customers: Number(s?.n_customers ?? 0), stamps30d: Number(s?.n_stamps_30d ?? 0),
          redemptions30d: Number(s?.n_redemptions_30d ?? 0), lastActivityAt: iso(s?.last_activity_at),
          stamps7d: Number(s?.n_stamps_7d ?? 0), lastStampAt: iso(s?.last_stamp_at)
        },
        ownerPhone: nn(r.owner_phone),
        inviteExpiresAt: o?.invitePending ? inviteOf.get(o.id) : undefined
      };
    });
  }

  /* ---------- Panel de administrador (0009) ---------- */

  const toPayment = (r: Row): AdminPayment => ({
    id: r.id, businessId: r.business_id, amountCents: Number(r.amount_cents), paidAt: String(r.paid_at).slice(0, 10), plan: planOf(r.plan),
    months: r.months == null ? null : Number(r.months), previousExpiresAt: iso(r.previous_expires_at), newExpiresAt: iso(r.new_expires_at)!,
    method: r.method, note: nn(r.note), createdBy: nn(r.created_by), createdAt: iso(r.created_at)!
  });
  const toAction = (r: Row): AdminAction => {
    const detail = (r.detail && typeof r.detail === 'object' ? r.detail : {}) as Record<string, unknown>;
    return {
      id: r.id, businessId: r.business_id, adminId: nn(r.admin_id), adminEmail: nn(r.platform_admins?.email), kind: r.kind,
      detail, summary: adminActionSummary(r.kind, detail), createdAt: iso(r.created_at)!
    };
  };
  const ACTION_SELECT = 'id,business_id,admin_id,kind,detail,created_at,platform_admins(email)';

  /** Conteos de admin_series (0009) separados por tipo. */
  async function seriesCounts(businessId: string | null): Promise<Record<'stamps' | 'redemptions' | 'customers' | 'businesses', Record<string, number>>> {
    const rows = must(await db.rpc('admin_series', { p_business_id: businessId }), 'Series') as Row[] | null;
    const out = { stamps: {}, redemptions: {}, customers: {}, businesses: {} } as Record<'stamps' | 'redemptions' | 'customers' | 'businesses', Record<string, number>>;
    for (const r of rows ?? []) {
      const k = r.kind as keyof typeof out;
      if (out[k]) out[k][String(r.bucket)] = Number(r.n) || 0;
    }
    return out;
  }

  /** Uso de IA (admin_ai_usage, 0009) por negocio desde `sinceIso`. */
  async function aiUsageSince(sinceIso: string, businessId: string | null): Promise<Record<string, AiUsage>> {
    const rows = must(await db.rpc('admin_ai_usage', { p_since: sinceIso, p_business_id: businessId }), 'Uso de IA') as Row[] | null;
    const out: Record<string, AiUsage> = {};
    for (const r of rows ?? []) {
      out[r.biz_id] = {
        texts: Number(r.texts) || 0, images: Number(r.images) || 0, promptTokens: Number(r.prompt_tokens) || 0,
        cachedTokens: Number(r.cached_tokens) || 0, completionTokens: Number(r.completion_tokens) || 0
      };
    }
    return out;
  }

  /** Tarjeta del cliente: negocio, programa, cliente y sus últimos 10 movimientos (sellos no anulados y canjes). */
  async function cardOf(business: Business, customer: Customer): Promise<CustomerCard> {
    const [program, claims, reds] = await Promise.all([
      getProg(business.id),
      db.from('stamp_claims').select('at').eq('business_id', business.id).eq('customer_id', customer.id).is('voided_at', null).order('at', { ascending: false }).limit(10),
      db.from('redemptions').select('at, milestone, reward_title').eq('business_id', business.id).eq('customer_id', customer.id).order('at', { ascending: false }).limit(10)
    ]);
    const recent: CustomerCard['recent'] = [
      ...(must(claims, 'Sellos') as Row[]).map((r) => ({ at: iso(r.at)!, kind: 'stamp' as const })),
      ...(must(reds, 'Canjes') as Row[]).map((r) => ({
        at: iso(r.at)!, kind: 'redeem' as const,
        ...(r.milestone != null ? { milestone: Number(r.milestone) } : {}), ...(r.reward_title ? { title: String(r.reward_title) } : {})
      }))
    ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at)).slice(0, 10);
    return { business, program, customer, recent };
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
      if (patch.province !== undefined) upd.province = patch.province.trim() || null;
      if (patch.timezone !== undefined) upd.timezone = patch.timezone;
      if (patch.type !== undefined) upd.type = patch.type;
      if (Object.keys(upd).length) must(await db.from('businesses').update(upd).eq('id', id).select('id').single(), 'Negocio');
      await db.from('audit_log').insert({ business_id: id, action: 'business.update', detail: 'Se actualizaron los datos del negocio.' });
      return getBiz(id);
    },

    async listLocations(businessId) {
      return (must(await db.from('locations').select('*').eq('business_id', businessId).is('deleted_at', null).order('created_at').order('id'), 'Sucursales') as Row[]).map(toLocation);
    },
    async upsertLocation(businessId, loc) {
      if (!loc.name?.trim()) throw new Error('Escribe el nombre de la sucursal.');
      const live = await repo.listLocations(businessId);
      if (loc.id && !live.some((l) => l.id === loc.id)) throw new Error('No encontramos esa sucursal.');
      if (!loc.id) {
        const limit = maxLocations((await getBiz(businessId)).plan);
        if (live.length >= limit) throw new Error(`Tu plan permite ${limit === 1 ? '1 sucursal' : `hasta ${limit} sucursales`}. Escríbenos para ampliarlo.`);
      }
      const row: Row = { business_id: businessId, name: loc.name.trim() };
      if (loc.id) row.id = loc.id;
      if (loc.address !== undefined) row.address = loc.address;
      if (loc.active !== undefined) row.active = loc.active;
      return toLocation(must(await db.from('locations').upsert(row).select('*').single(), 'Sucursal'));
    },

    async deleteLocation(businessId, id, actorId) {
      const live = await repo.listLocations(businessId);
      const loc = live.find((l) => l.id === id);
      if (!loc) throw new Error('No encontramos esa sucursal.');
      if (live.length <= 1) throw new Error('Debe quedar al menos una sucursal.');
      must(await db.from('locations').update({ deleted_at: new Date().toISOString(), active: false }).eq('business_id', businessId).eq('id', id), 'Sucursal');
      await logAudit(businessId, actorId, 'location.delete', `Se eliminó la sucursal ${loc.name}.`);
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
      {
        const willBeMember = (s.active ?? current?.active ?? true) && s.role !== 'owner';
        const alreadyMember = !!current && current.active && current.role !== 'owner';
        if (willBeMember && !alreadyMember) {
          const plan = (await getBiz(businessId)).plan;
          const used = (await listStaffRows(businessId)).filter((x) => x.active && x.role !== 'owner' && x.id !== s.id).length;
          if (used >= maxStaff(plan)) throw new Error(staffLimitError(plan));
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

    async verifyCredentials(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const row = email ? await authLookup(email) : null;
      if (!row) {
        await verifyPassword(password, null); // iguala tiempos
        if (!unknownEmails.lockedFor(email)) unknownEmails.fail(email);
        return null;
      }
      const locked = !!row.locked_until && Date.parse(row.locked_until) > Date.now();
      const ok = await verifyPassword(password, row.password_hash);
      if (locked) return null;
      if (!ok) { await rpc('auth_record_failure', { p_staff_id: row.id }); return null; }
      if (!row.active) return null;
      await rpc('auth_record_success', { p_staff_id: row.id });
      return { businessId: row.business_id as string, staffId: row.id as string };
    },

    async isLoginLocked(rawEmail) {
      const email = normalizeEmail(rawEmail);
      const row = email ? await authLookup(email) : null;
      if (!row) return unknownEmails.lockedFor(email) > 0;
      return !!row.locked_until && Date.parse(row.locked_until) > Date.now();
    },

    async setStaffCredentials(staffId, rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const err = validateEmail(email) ?? validatePassword(password);
      if (err) throw new Error(err);
      const hash = await hashPassword(password);
      const { data, error } = await db.from('staff')
        .update({ email, password_hash: hash, failed_logins: 0, locked_until: null }).eq('id', staffId).select('id,business_id,name');
      if (error) throw new Error(error.code === '23505' ? 'Ese correo ya está en uso.' : `Equipo: ${error.message}`);
      const row = (data ?? [])[0] as Row | undefined;
      if (!row) throw new Error('No encontramos a esa persona del equipo.');
      await db.from('audit_log').insert({ business_id: row.business_id, staff_id: null, action: 'staff.credentials', detail: `Se configuró el acceso por correo de ${row.name}.` });
    },

    async getProgram(businessId) { return getProg(businessId); },
    async updateProgram(businessId, patch, actorId) {
      const err = validateProgramPatch(patch);
      if (err) throw new Error(err);
      const map: Record<string, string> = {
        name: 'name', stampsRequired: 'stamps_required', rewardTitle: 'reward_title', rewardDescription: 'reward_description',
        requireAmount: 'require_amount', minSpendCentsPerStamp: 'min_spend_cents_per_stamp', codeTtlSeconds: 'code_ttl_seconds',
        maxSeatsWithoutApproval: 'max_seats_without_approval', cooldownMinutes: 'cooldown_minutes', colors: 'colors',
        logoText: 'logo_text', logoUrl: 'logo_url', terms: 'terms', birthdayReward: 'birthday_reward', rewardExpiresDays: 'reward_expires_days',
        coverUrl: 'cover_url', milestones: 'milestones', imageFraming: 'image_framing', poster: 'poster'
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

    async redeemReward(businessId, customerId, staffId, milestone) {
      const r = await rpcOrThrow('redeem_reward', { p_business_id: businessId, p_customer_id: customerId, p_staff_id: staffId, p_milestone: milestone ?? null });
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
    },

    /* =============================== MVP (ver docs/MVP.md) =============================== */

    async createBusinessAccess(input) {
      const email = normalizeEmail(input.ownerEmail);
      const err = validateEmail(email);
      if (err) fail(err);
      if (await authLookup(email)) fail('Ese correo ya tiene acceso a Stampa.');
      if (!PLANS.includes(input.plan)) fail('Elige un plan válido.');
      if (input.planExpiresAt && Number.isNaN(Date.parse(input.planExpiresAt))) fail('La fecha de vencimiento no es válida.');
      const token = generateToken();
      // Todo en una transacción (create_business_access): si algo falla no queda un negocio a medias.
      const r = await rpcOrThrow('create_business_access', {
        p_email: email, p_plan: input.plan, p_plan_expires_at: input.planExpiresAt ? new Date(input.planExpiresAt).toISOString() : null,
        p_note: input.note?.trim() ? input.note.trim().slice(0, 500) : null, p_business_name: PLACEHOLDER_BUSINESS_NAME,
        p_slug: provisionalSlug(), p_owner_name: email.split('@')[0].slice(0, 80) || 'Dueño', p_program: getTemplate('otro').program,
        p_token_hash: hashToken(token), p_invite_ttl_seconds: INVITE_TTL_HOURS * 3600
      });
      if (input.autoRenew && input.planExpiresAt) must(await db.from('businesses').update({ auto_renew: true }).eq('id', r.business_id), 'Negocio');
      const invite: IssuedToken = { token, kind: 'invite', expiresAt: iso(r.expires_at)! };
      return { business: await getBiz(r.business_id), ownerId: r.owner_id as string, invite };
    },

    async listAdminBusinesses() { return adminRows(); },

    async getAdminBusiness(id) { return (await adminRows(id))[0] ?? null; },

    async getPlatformSummary(): Promise<PlatformSummary> {
      const now = Date.now();
      const [rows, totals] = await Promise.all([
        fetchAll((f, t) => db.from('businesses').select('id,status,plan_expires_at,auto_renew').order('id').range(f, t), 'Negocios'),
        rpc('platform_stats', {})
      ]);
      const st = (r: Row) => (r.status ?? 'active') as string;
      const exp = (r: Row) => { const e = effectiveExpiry(iso(r.plan_expires_at), !!r.auto_renew, now); return e ? Date.parse(e) : Infinity; };
      return {
        businesses: {
          total: rows.length,
          active: rows.filter((r) => st(r) === 'active').length,
          setup: rows.filter((r) => st(r) === 'setup').length,
          suspended: rows.filter((r) => st(r) === 'suspended').length,
          expiringSoon: rows.filter((r) => st(r) !== 'suspended' && exp(r) >= now && exp(r) - now <= 7 * DAY).length,
          expired: rows.filter((r) => st(r) !== 'suspended' && exp(r) < now).length
        },
        customers: Number(totals.customers ?? 0),
        stampsTotal: Number(totals.stamps_total ?? 0),
        stamps30d: Number(totals.stamps_30d ?? 0),
        redemptionsTotal: Number(totals.redemptions_total ?? 0),
        redemptions30d: Number(totals.redemptions_30d ?? 0)
      };
    },

    async setBusinessStatus(id, status) {
      const b = await getBiz(id);
      if (status === 'suspended') {
        if (b.status !== 'suspended') {
          const upd: Row = { status: 'suspended', suspended_at: new Date().toISOString() };
          // Un negocio activo ya terminó su configuración (los anteriores al MVP no tienen la fecha): al reactivarlo vuelve a 'active'.
          if (b.status === 'active' && !b.setupCompletedAt) upd.setup_completed_at = b.createdAt;
          must(await db.from('businesses').update(upd).eq('id', id), 'Negocio');
        }
        await logAudit(id, null, 'business.suspend', 'Stampa suspendió el negocio.');
      } else {
        const next = b.setupCompletedAt || b.status === 'active' ? 'active' : 'setup';
        must(await db.from('businesses').update({ status: next, suspended_at: null }).eq('id', id), 'Negocio');
        await logAudit(id, null, 'business.reactivate', 'Stampa reactivó el negocio.');
      }
      return getBiz(id);
    },

    async updateBusinessPlan(id, plan, planExpiresAt, note, autoRenew) {
      await getBiz(id);
      if (!PLANS.includes(plan)) fail('Elige un plan válido.');
      if (planExpiresAt && Number.isNaN(Date.parse(planExpiresAt))) fail('La fecha de vencimiento no es válida.');
      const exp = planExpiresAt ? new Date(planExpiresAt).toISOString() : null;
      const upd: Row = { plan, plan_expires_at: exp };
      if (autoRenew !== undefined) upd.auto_renew = autoRenew && !!exp;
      if (note !== undefined) upd.admin_note = note.trim() ? note.trim().slice(0, 500) : null;
      must(await db.from('businesses').update(upd).eq('id', id), 'Negocio');
      await logAudit(id, null, 'business.plan', `Plan ${PLAN_LABEL[plan]}${exp ? ` hasta ${exp.slice(0, 10)}` : ' sin vencimiento'}.`);
      return getBiz(id);
    },

    /* ---------- Administradores ---------- */
    async verifyAdminCredentials(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const rec = email ? await adminLookup(email) : null;
      if (!rec) {
        await verifyPassword(password, null); // iguala tiempos
        if (!unknownAdmins.lockedFor(email)) unknownAdmins.fail(email);
        return null;
      }
      const locked = !!rec.locked_until && Date.parse(rec.locked_until) > Date.now();
      const ok = await verifyPassword(password, rec.password_hash);
      if (locked) return null;
      if (!ok) { await rpc('admin_record_failure', { p_admin_id: rec.id }); return null; }
      await rpc('admin_record_success', { p_admin_id: rec.id });
      return { adminId: rec.id as string };
    },

    async isAdminLoginLocked(rawEmail) {
      const email = normalizeEmail(rawEmail);
      const rec = email ? await adminLookup(email) : null;
      if (!rec) return unknownAdmins.lockedFor(email) > 0;
      return !!rec.locked_until && Date.parse(rec.locked_until) > Date.now();
    },

    async getAdmin(id) {
      const row = must(await db.from('platform_admins').select('id,email,created_at,last_login_at').eq('id', id).maybeSingle(), 'Administrador') as Row | null;
      return row ? toAdmin(row) : null;
    },

    async upsertAdmin(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const err = validateEmail(email) ?? validatePassword(password);
      if (err) fail(err);
      const passwordHash = await hashPassword(password);
      const row = must<Row>(await db.from('platform_admins')
        .upsert({ email, password_hash: passwordHash, failed_logins: 0, locked_until: null }, { onConflict: 'email' })
        .select('id,email,created_at,last_login_at').single(), 'Administrador');
      return toAdmin(row);
    },

    async changeAdminPassword(adminId, currentPassword, newPassword) {
      const row = must(await db.from('platform_admins').select('id,password_hash').eq('id', adminId).maybeSingle(), 'Administrador') as Row | null;
      if (!row) return fail('No encontramos esa cuenta.');
      if (!(await verifyPassword(currentPassword, row.password_hash))) fail('La contraseña actual no es correcta.');
      const err = validatePassword(newPassword);
      if (err) fail(err);
      if (newPassword === currentPassword) fail('La contraseña nueva debe ser distinta de la actual.');
      must(await db.from('platform_admins').update({ password_hash: await hashPassword(newPassword) }).eq('id', adminId), 'Administrador');
    },

    /* ---------- Enlaces de un solo uso ---------- */
    async issueAccessToken(staffId, kind) {
      const token = generateToken();
      const r = await rpcOrThrow('issue_access_token', {
        p_staff_id: staffId, p_kind: kind, p_token_hash: hashToken(token),
        p_ttl_seconds: kind === 'invite' ? INVITE_TTL_HOURS * 3600 : RESET_TTL_MINUTES * 60
      });
      const out: IssuedToken = { token, kind, expiresAt: iso(r.expires_at)! };
      return out;
    },

    async peekAccessToken(token) {
      if (!isTokenShape(token)) return null;
      const { data, error } = await db.rpc('peek_access_token', { p_hash: hashToken(token) });
      if (error) throw new Error(error.message);
      if (!data) return null;
      const r = data as Row;
      const info: AccessTokenInfo = {
        kind: r.kind, staffId: r.staff_id, businessId: r.business_id, email: r.email, staffName: r.staff_name,
        businessName: r.business_name, businessStatus: r.business_status ?? 'active', expiresAt: iso(r.expires_at)!
      };
      return info;
    },

    async consumeAccessToken(token, password, name) {
      // Mismo orden de errores que memory.ts: primero el enlace, luego la contraseña y el nombre.
      if (!(await repo.peekAccessToken(token))) fail('Este enlace ya no es válido. Pide uno nuevo.');
      const err = validatePassword(password);
      if (err) fail(err);
      if (name !== undefined) { const e = validateName(name); if (e) fail(e); }
      const r = await rpcOrThrow('consume_access_token', {
        p_hash: hashToken(token), p_password_hash: await hashPassword(password), p_name: name === undefined ? null : name.trim()
      });
      return { businessId: r.business_id as string, staffId: r.staff_id as string };
    },

    async findStaffByEmail(rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!email) return null;
      const row = must(await db.from('staff').select(STAFF_COLS).eq('email', email).eq('active', true).maybeSingle(), 'Equipo') as Row | null;
      return row ? toStaff(row) : null;
    },

    async setStaffEmail(businessId, staffId, rawEmail, actorId) {
      const email = normalizeEmail(rawEmail);
      const err = validateEmail(email);
      if (err) fail(err);
      await rpcOrThrow('set_staff_email', { p_business_id: businessId, p_staff_id: staffId, p_email: email, p_actor_id: actorId ?? null });
      const row = must<Row>(await db.from('staff').select(STAFF_COLS).eq('business_id', businessId).eq('id', staffId).single(), 'Equipo');
      return toStaff(row);
    },

    /* ---------- Asistente del dueño ---------- */
    async saveBusinessSetup(businessId, input: BusinessSetupInput, actorId) {
      const b = await getBiz(businessId);
      const name = input.name?.trim() ?? '';
      if (name.length < 2) fail('Escribe el nombre de tu negocio.');
      if (name.length > 80) fail('El nombre es demasiado largo (máximo 80 letras).');
      if (name.toLowerCase() === PLACEHOLDER_BUSINESS_NAME.toLowerCase()) fail('Escribe el nombre real de tu negocio.');
      const typeChanged = b.type !== input.type;
      const upd: Row = { name, type: input.type, city: input.city?.trim() || null, province: input.province?.trim() || null };
      if (b.status === 'setup') {
        // Mientras no esté activo, el slug sigue al nombre (-2, -3... si ya existe). Después ya no cambia: el QR impreso depende de él.
        const base = slugify(name);
        for (let n = 1; ; n++) {
          if (n > 500) fail('No pudimos generar el enlace del negocio. Prueba con otro nombre.');
          const slug = n === 1 ? base : `${base}-${n}`;
          const taken = must(await db.from('businesses').select('id').eq('slug', slug).neq('id', businessId).limit(1), 'Negocio') as Row[];
          if (taken.length) continue;
          const res = await db.from('businesses').update({ ...upd, slug }).eq('id', businessId);
          if (res.error?.code === '23505') continue;   // otro negocio tomó ese slug en este instante
          must(res, 'Negocio');
          break;
        }
        const prog: Row = { logo_text: initials(name) };
        if (typeChanged) Object.assign(prog, templateProgramRow(getTemplate(input.type).program));   // conserva logo y portada
        must(await db.from('programs').update(prog).eq('business_id', businessId), 'Programa');
      } else {
        must(await db.from('businesses').update(upd).eq('id', businessId), 'Negocio');
      }
      await logAudit(businessId, actorId, 'business.update', 'Se guardaron los datos del negocio.');
      return getBiz(businessId);
    },

    async completeBusinessSetup(businessId, actorId) {
      const b = await getBiz(businessId);
      if (b.status === 'suspended') fail('Tu cuenta está suspendida. Escríbenos por WhatsApp.');
      if (b.name === PLACEHOLDER_BUSINESS_NAME) fail('Primero escribe el nombre de tu negocio.');
      const locs = must(await db.from('locations').select('id').eq('business_id', businessId).eq('active', true).is('deleted_at', null).limit(1), 'Sucursales') as Row[];
      if (!locs.length) fail('Agrega al menos una sucursal.');
      if (b.status === 'setup') {
        must(await db.from('businesses').update({ status: 'active', setup_completed_at: new Date().toISOString() }).eq('id', businessId).eq('status', 'setup'), 'Negocio');
      }
      await logAudit(businessId, actorId, 'business.ready', `${b.name} terminó su configuración.`);
      return getBiz(businessId);
    },

    async uploadBusinessImage(businessId, kind, file) {
      await getBiz(businessId);
      const err = validateBusinessImage(file);
      if (err) fail(err);
      const k = kind === 'logo' ? 'logo' : 'cover';
      const path = `${businessId}/${k}-${Date.now()}.${IMAGE_EXT[file.contentType]}`;
      const bucket = db.storage.from('branding');
      const up = await bucket.upload(path, file.bytes, { contentType: file.contentType, upsert: false, cacheControl: '31536000' });
      if (up.error) throw new Error(`Imagen: ${up.error.message}`);
      const url = bucket.getPublicUrl(path).data.publicUrl;
      must(await db.from('programs').update(k === 'logo' ? { logo_url: url } : { cover_url: url }).eq('business_id', businessId), 'Programa');
      return url;
    },

    /* ---------- Clientes (página pública) ---------- */
    async getBusinessBySlug(slug) {
      if (!slug) return null;
      const row = must(await db.from('businesses').select('*').eq('slug', slug).maybeSingle(), 'Negocio');
      return row ? toBusiness(row) : null;
    },

    async findCustomerByEmail(businessId, rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!email) return null;
      const row = must(await db.from('customers').select('*').eq('business_id', businessId).eq('contact_kind', 'email').eq('contact', email).maybeSingle(), 'Cliente');
      return row ? toCustomer(row) : null;
    },

    async listCustomerCards(rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!email) return [];
      const rows = must(await db.from('customers').select('*, businesses!inner(*)')
        .eq('contact_kind', 'email').eq('contact', email).neq('businesses.status', 'setup'), 'Tarjetas') as Row[];
      const cards = await Promise.all(rows.map((r) => cardOf(toBusiness(r.businesses), toCustomer(r))));
      const when = (c: CustomerCard) => Date.parse(c.customer.lastVisitAt ?? c.customer.createdAt);
      return cards.sort((a, b) => when(b) - when(a));
    },

    async setCustomerWallet(businessId, customerId, wallet) {
      must(await db.from('customers').update({ wallet }).eq('business_id', businessId).eq('id', customerId), 'Cliente');
    },

    async getCustomerCard(businessId, customerId) {
      const [b, c] = await Promise.all([
        repo.getBusiness(businessId),
        db.from('customers').select('*').eq('business_id', businessId).eq('id', customerId).maybeSingle()
      ]);
      const row = must(c, 'Cliente');
      return b && row ? cardOf(b, toCustomer(row)) : null;
    },

    async registerVerifiedCustomer(businessId, input) {
      const b = await getBiz(businessId);
      if ((b.status ?? 'active') !== 'active') fail('Este negocio no está recibiendo clientes nuevos por ahora.');
      const v = validateContact('email', input.email);
      if (!v.ok) return fail(v.error);
      const contact = v.contact;
      const findExisting = async () => must(await db.from('customers').select('*').eq('business_id', businessId).eq('contact', contact).maybeSingle(), 'Cliente') as Row | null;
      const markVerified = async (row: Row): Promise<Customer> => {
        if (row.email_verified_at) return toCustomer(row);
        const upd = must<Row>(await db.from('customers').update({ email_verified_at: new Date().toISOString() }).eq('id', row.id).select('*').single(), 'Cliente');
        return toCustomer(upd);
      };
      const existing = await findExisting();
      if (existing) return markVerified(existing);
      const nameErr = validateName(input.name);
      if (nameErr) fail(nameErr);
      const bErr = validateBirthday(input.birthday) ?? validateBirthYear(input.birthdayYear);
      if (bErr) fail(bErr);
      const at = new Date().toISOString();
      const res = await db.from('customers').insert({
        business_id: businessId, name: input.name.trim(), contact, contact_kind: 'email',
        birthday_d: input.birthday?.d ?? null, birthday_m: input.birthday?.m ?? null, birthday_y: input.birthdayYear ?? null,
        consent_at: at, created_at: at, email_verified_at: at
      }).select('*').single();
      if (res.error?.code === '23505') {   // se registró en paralelo (doble toque): devuelve el existente
        const again = await findExisting();
        if (again) return markVerified(again);
      }
      return toCustomer(must(res, 'Cliente') as Row);
    },

    async requestEmailOtp(rawEmail) {
      const email = normalizeEmail(rawEmail);
      const err = validateEmail(email);
      if (err) return { ok: false, error: err };
      const code = generateOtp();
      const r = await rpc('request_email_otp', {
        p_email: email, p_code_hash: hashOtp(email, code), p_ttl_seconds: OTP_TTL_MINUTES * 60, p_max_per_hour: OTP_MAX_PER_HOUR
      });
      if (!r.ok) return { ok: false, error: (r.error as string) ?? 'No pudimos generar el código. Inténtalo de nuevo.' };
      return { ok: true, code, expiresAt: iso(r.expires_at)! };
    },

    async verifyEmailOtp(rawEmail, code) {
      const email = normalizeEmail(rawEmail);
      if (!email || !/^\d{6}$/.test((code ?? '').trim())) return false;
      const { data, error } = await db.rpc('verify_email_otp', { p_email: email, p_code_hash: hashOtp(email, code), p_max_attempts: OTP_MAX_ATTEMPTS });
      if (error) throw new Error(error.message);
      return data === true;
    },

    async recordMarketing(businessId, g) {
      const r = must(await db.from('marketing_generations').insert({
        business_id: businessId, staff_id: g.staffId ?? null, kind: g.kind, topic: g.topic ?? null, output: g.output ?? {}, model: g.model ?? null,
        prompt_tokens: g.promptTokens ?? 0, cached_tokens: g.cachedTokens ?? 0, completion_tokens: g.completionTokens ?? 0
      }).select('*').single(), 'Marketing') as Row;
      return toMarketing(r);
    },

    async countMarketingSince(businessId, sinceIso, kinds) {
      let q = db.from('marketing_generations').select('id', { count: 'exact', head: true })
        .eq('business_id', businessId).gte('created_at', sinceIso);
      if (kinds?.length) q = q.in('kind', kinds);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async uploadMarketingPhoto(businessId, file) {
      await getBiz(businessId);
      const err = validateMarketingPhoto(file);
      if (err) fail(err);
      const id = newPhotoId(file.contentType === 'image/png' ? 'png' : 'jpg');
      const bucket = db.storage.from('branding');
      const up = await bucket.upload(`${businessId}/marketing/${id}`, file.bytes, { contentType: file.contentType, upsert: false, cacheControl: '31536000' });
      if (up.error) throw new Error(`Foto: ${up.error.message}`);
      return { id, url: bucket.getPublicUrl(`${businessId}/marketing/${id}`).data.publicUrl, createdAt: new Date().toISOString() };
    },

    async listMarketingPhotos(businessId, limit = 24) {
      const bucket = db.storage.from('branding');
      const { data, error } = await bucket.list(`${businessId}/marketing`, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
      if (error) throw new Error(`Fotos: ${error.message}`);
      return (data ?? []).filter((f) => PHOTO_ID_RE.test(f.name)).slice(0, limit).map((f) => ({
        id: f.name, url: bucket.getPublicUrl(`${businessId}/marketing/${f.name}`).data.publicUrl,
        createdAt: new Date(Number(f.name.split('-')[1])).toISOString()
      }));
    },

    async marketingPhotoUrl(businessId, photoId) {
      if (!PHOTO_ID_RE.test(photoId) || !/^[a-z0-9_]+$/i.test(businessId)) return null;
      return db.storage.from('branding').getPublicUrl(`${businessId}/marketing/${photoId}`).data.publicUrl;
    },

    async finishMarketing(businessId, id, patch) {
      if (patch === null) {
        must(await db.from('marketing_generations').delete().eq('id', id).eq('business_id', businessId), 'Marketing');
        return;
      }
      const upd: Record<string, unknown> = {};
      if (patch.output !== undefined) upd.output = patch.output;
      if (patch.model) upd.model = patch.model;
      if (Object.keys(upd).length) must(await db.from('marketing_generations').update(upd).eq('id', id).eq('business_id', businessId), 'Marketing');
    },

    async listMarketing(businessId, limit = 30) {
      const rows = must(await db.from('marketing_generations').select('*').eq('business_id', businessId)
        .order('created_at', { ascending: false }).limit(limit), 'Marketing') as Row[];
      return rows.map(toMarketing);
    },

    async marketingUsage(sinceIso, businessId) {
      let q = db.from('marketing_generations').select('business_id,prompt_tokens,cached_tokens,completion_tokens').gte('created_at', sinceIso).limit(10000);
      if (businessId) q = q.eq('business_id', businessId);
      const rows = must(await q, 'Marketing') as Row[];
      const out: Record<string, MarketingUsage> = {};
      for (const r of rows) {
        const u = (out[r.business_id] ??= { count: 0, promptTokens: 0, cachedTokens: 0, completionTokens: 0 });
        u.count++; u.promptTokens += Number(r.prompt_tokens) || 0; u.cachedTokens += Number(r.cached_tokens) || 0; u.completionTokens += Number(r.completion_tokens) || 0;
      }
      return out;
    },

    /* ---------- Panel de administrador: métricas, cobros, historial y teléfono (0009) ---------- */
    async getAdminInsights(now) {
      // Las ventanas de 7 y 30 días y las series las calcula Postgres con now(); `now` solo fija el lado de la app.
      const nowMs = now ? now.getTime() : Date.now();
      const sinceDay = ecDayKey(nowMs - 200 * DAY);
      const [rows, counts, pays, aiUsage] = await Promise.all([
        adminRows(),
        seriesCounts(null),
        fetchAll((f, t) => db.from('admin_payments').select('amount_cents,paid_at').gte('paid_at', sinceDay).order('paid_at').order('id').range(f, t), 'Pagos'),
        aiUsageSince(ecMonthStartIso(nowMs), null)
      ]);
      return buildAdminInsights({
        now: nowMs,
        rows,
        counts: { businessesByMonth: counts.businesses, customersByWeek: counts.customers, stampsByDay: counts.stamps, redemptionsByDay: counts.redemptions },
        payments: pays.map((p) => ({ amountCents: Number(p.amount_cents), paidAt: String(p.paid_at).slice(0, 10) })),
        aiUsage
      });
    },

    async getAdminBusinessDetail(id) {
      const row = (await adminRows(id))[0];
      if (!row) return null;
      const nowMs = Date.now();
      const [progRow, locations, staffRows, alerts, counts, payments, actions, ai] = await Promise.all([
        db.from('programs').select('*').eq('business_id', id).maybeSingle(),
        repo.listLocations(id),
        db.from('staff').select(STAFF_COLS).eq('business_id', id).order('created_at').order('id'),
        repo.listAlerts(id, 500).catch(() => [] as Alert[]),
        seriesCounts(id),
        repo.listPayments(id, 200),
        repo.listAdminActions(id, 50),
        aiUsageSince(ecMonthStartIso(nowMs), id)
      ]);
      const program = must(progRow, 'Programa') as Row | null;
      const b = row.business;
      const detail: AdminBusinessDetail = {
        row,
        health: businessHealth({ status: b.status, createdAt: b.createdAt, setupCompletedAt: b.setupCompletedAt, lastStampAt: row.stats.lastStampAt }, nowMs),
        daysSinceLastStamp: daysSince(row.stats.lastStampAt, nowMs),
        program: program ? toProgram(program) : null,
        locations,
        staff: (must(staffRows, 'Equipo') as Row[]).map((r) => ({
          id: r.id, name: r.name, role: r.role, active: r.active, email: nn(r.email), hasPassword: !!r.has_password,
          invitePending: !!r.email && !r.has_password, createdAt: iso(r.created_at)!
        })),
        alerts: {
          total: alerts.length,
          critical: alerts.filter((a) => a.severity === 'critical').length,
          warning: alerts.filter((a) => a.severity === 'warning').length,
          recent: alerts.slice(0, 10)
        },
        stampsByDay: fillSeries('day', 90, nowMs, counts.stamps),
        redemptionsByDay: fillSeries('day', 90, nowMs, counts.redemptions),
        customers: row.stats.customers,
        payments,
        actions,
        ai: aiCostRow(b, ai[id])
      };
      return detail;
    },

    async recordPayment(input: NewPaymentInput) {
      const raw = must(await db.from('businesses').select('id,plan,plan_expires_at,auto_renew').eq('id', input.businessId).maybeSingle(), 'Negocio') as Row | null;
      if (!raw) return fail('No encontramos ese negocio.');
      const nowMs = Date.now();
      const note = input.note?.trim() || undefined;
      const newExpiresAt = input.newExpiresAt?.trim() || undefined;
      const months = newExpiresAt ? input.months : input.months ?? 1;
      const err = validatePayment({ ...input, newExpiresAt, months, note }, nowMs);
      if (err) fail(err.error);
      const plan = planOf(raw.plan);
      // Con renovación automática el vencimiento vigente es el "rodado" (effectiveExpiry); el control usa el guardado.
      const current = effectiveExpiry(iso(raw.plan_expires_at), !!raw.auto_renew, nowMs);
      const next = nextPlanExpiry({ currentExpiresAt: current, paidAt: input.paidAt, months, newExpiresAt });
      const r = await rpcOrThrow('admin_record_payment', {
        p_business_id: input.businessId, p_amount_cents: input.amountCents, p_paid_at: input.paidAt, p_plan: input.plan ?? plan,
        p_months: next.months, p_prev_expires_at: raw.plan_expires_at ?? null, p_new_expires_at: next.expiresAt, p_method: input.method,
        p_note: note ?? null, p_admin_id: input.createdBy ?? null,
        p_detail: { amountCents: input.amountCents, months: next.months, method: input.method, previousExpiresAt: current ?? null, newExpiresAt: next.expiresAt },
        p_audit_detail: `Pago registrado. Plan ${PLAN_LABEL[plan]} hasta ${ecDayKey(next.expiresAt)}.`
      });
      const payment = toPayment(must(await db.from('admin_payments').select('*').eq('id', r.payment_id).single(), 'Pago'));
      return { payment, business: await getBiz(input.businessId) };
    },

    async listPayments(businessId, limit = 100) {
      const rows = must(await db.from('admin_payments').select('*').eq('business_id', businessId)
        .order('paid_at', { ascending: false }).order('created_at', { ascending: false }).limit(limit), 'Pagos') as Row[];
      return rows.map(toPayment);
    },

    async logAdminAction(input) {
      const res = await db.from('admin_actions').insert({
        business_id: input.businessId, admin_id: input.adminId ?? null, kind: input.kind, detail: input.detail ?? {}
      }).select(ACTION_SELECT).single();
      if (res.error?.code === '23503') {
        // admin_id que ya no existe: se guarda sin admin (el negocio inexistente sí es error).
        if (/admin_id/.test(res.error.message)) {
          return toAction(must(await db.from('admin_actions').insert({ business_id: input.businessId, admin_id: null, kind: input.kind, detail: input.detail ?? {} })
            .select(ACTION_SELECT).single(), 'Historial'));
        }
        throw new Error('No encontramos ese negocio.');
      }
      return toAction(must(res, 'Historial'));
    },

    async listAdminActions(businessId, limit = 50) {
      const rows = must(await db.from('admin_actions').select(ACTION_SELECT).eq('business_id', businessId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit), 'Historial') as Row[];
      return rows.map(toAction);
    },

    async setOwnerPhone(businessId, phone) {
      let value: string | null = null;
      if (phone !== null && phone.trim() !== '') {
        const r = normalizeEcPhone(phone);
        if (!r.ok) return fail(r.error);
        value = r.phone;
      }
      const rows = must(await db.from('businesses').update({ owner_phone: value }).eq('id', businessId).select('id'), 'Negocio') as Row[];
      if (!rows.length) fail('No encontramos ese negocio.');
      return value;
    }
  };

  return repo;
}
