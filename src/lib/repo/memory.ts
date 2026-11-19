import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type {
  Alert, AuditEntry, Business, ClaimResult, CreateCodeResult, Customer, CustomerDetail, CustomerQuery, CustomerRow,
  DashboardData, Location, NewBusinessInput, NewStampCodeInput, Program, RangeKey, Redemption, Role, Staff,
  StaffReportRow, StampCode
} from '../contracts';
import {
  codeStatus, cupos, generateCode, needsApproval, normalizeTicket, slugify, initials,
  tzOffsetMinutes, validateBirthday, validateContact, validateName, validateNewCode, validatePin, validateProgramPatch
} from '../domain';
import {
  buildCustomerHistory, buildDashboard, buildStaffReport, deriveAlerts, filterCustomers,
  type AnalyticsInput, type Rejection
} from '../domain/analytics';
import { buildSeed, DEMO_PASSWORD } from '../seed';
import { normalizeEmail, validateEmail } from '../credentials';
import { hashPassword, hashPasswordSync, validatePassword, verifyPassword } from '../password';
import { AttemptLimiter, LOCK_MS, MAX_FAILED_LOGINS } from '../login-throttle';
import { getTemplate } from '../templates';
import type { Repo } from './index';

/**
 * Repositorio en memoria. Es la implementación por defecto (datos de ejemplo de 5 negocios, ver seed.ts).
 * - Todo método es asíncrono pero el cuerpo crítico no tiene `await`, así que cada operación es atómica en Node.
 * - Los PIN se guardan con scrypt + sal; nunca salen del repo (Staff solo expone hasPin).
 * - Los errores de reglas de negocio llegan en español: createStampCode/claimStampCode los devuelven en el resultado;
 *   el resto de métodos lanza Error con el mensaje listo para mostrar.
 */

export interface MemoryRepoOptions {
  /** false = repositorio vacío (útil en pruebas). Por defecto carga los datos de ejemplo. */
  seed?: boolean;
  /** Reloj inyectable para pruebas. */
  clock?: () => number;
}

interface StaffRec extends Staff { pinHash?: string; passwordHash?: string; failedLogins?: number; lockedUntil?: number }

/** Un solo hash para todas las cuentas de ejemplo (misma contraseña de demo); se calcula una vez por proceso. */
let demoPasswordHash: string | undefined;

const hashPin = (pin: string): string => {
  const salt = randomBytes(8).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32, { N: 1024 }).toString('hex')}`;
};
const checkPin = (pin: string, stored?: string): boolean => {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const a = scryptSync(pin, salt, 32, { N: 1024 });
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};

const clone = <T>(v: T): T => structuredClone(v);
const strip = (s: StaffRec): Staff => { const { pinHash: _p, passwordHash: _h, failedLogins: _f, lockedUntil: _l, ...rest } = s; return { ...rest, hasPin: !!s.pinHash }; };
const fail = (msg: string): never => { throw new Error(msg); };

export function createMemoryRepo(opts: MemoryRepoOptions = {}): Repo {
  const clock = opts.clock ?? (() => Date.now());
  const nowIso = () => new Date(clock()).toISOString();

  const businesses: Business[] = [];
  const locations: Location[] = [];
  const staff: StaffRec[] = [];
  const programs: Program[] = [];
  const customers: Customer[] = [];
  const codes: StampCode[] = [];
  const redemptions: Redemption[] = [];
  const audit: AuditEntry[] = [];
  const rejections: Rejection[] = [];
  /** Fallos de correos que no existen: bloquean igual que los de cuentas reales para no revelar cuáles existen. */
  const unknownEmails = new AttemptLimiter(MAX_FAILED_LOGINS, LOCK_MS);

  if (opts.seed !== false) {
    const seed = buildSeed(clock());
    businesses.push(...seed.businesses);
    locations.push(...seed.locations);
    demoPasswordHash ??= hashPasswordSync(DEMO_PASSWORD);
    for (const s of seed.staff) { const { pin, ...rest } = s; staff.push({ ...rest, pinHash: hashPin(pin), passwordHash: demoPasswordHash }); }
    programs.push(...seed.programs);
    customers.push(...seed.customers);
    codes.push(...seed.codes);
    redemptions.push(...seed.redemptions);
    audit.push(...seed.audit);
    rejections.push(...seed.rejections);
  }

  // Los ids de lo creado en ejecución llevan 5 dígitos (10001...); los de ejemplo, 3 o 4: no chocan.
  let seq = 10000;
  const newId = (prefix: string, businessId?: string) => `${prefix}_${businessId ? businessId.replace('biz_', '') + '_' : ''}${++seq}`;
  const log = (businessId: string, staffId: string | undefined, action: string, detail: string) => {
    audit.push({ id: newId('aud', businessId), businessId, staffId, action, detail, at: nowIso() });
  };
  const reject = (businessId: string, r: Omit<Rejection, 'id' | 'businessId' | 'at'>) => {
    rejections.push({ id: newId('rej', businessId), businessId, at: nowIso(), ...r });
  };

  const biz = (id: string) => businesses.find((b) => b.id === id) ?? fail('No encontramos ese negocio.');
  const prog = (id: string) => programs.find((p) => p.businessId === id) ?? fail('Ese negocio no tiene programa configurado.');
  const findCustomer = (businessId: string, id: string) => customers.find((c) => c.id === id && c.businessId === businessId);
  const bizStaff = (businessId: string) => staff.filter((s) => s.businessId === businessId);
  const bizCodes = (businessId: string) => codes.filter((c) => c.businessId === businessId);
  const staffName = (id?: string) => staff.find((s) => s.id === id)?.name;

  const analytics = (businessId: string): AnalyticsInput => ({
    now: new Date(clock()),
    offsetMin: tzOffsetMinutes(biz(businessId).timezone, clock()),
    customers: customers.filter((c) => c.businessId === businessId),
    codes: bizCodes(businessId),
    redemptions: redemptions.filter((r) => r.businessId === businessId),
    staff: bizStaff(businessId).map((s) => ({ id: s.id, name: s.name, active: s.active, role: s.role }))
  });

  /** PIN de un dueño o gerente activo del negocio. Devuelve su id. */
  const findApprover = (businessId: string, pin: string): string | undefined =>
    bizStaff(businessId).find((s) => s.active && (s.role === 'owner' || s.role === 'manager') && checkPin(pin, s.pinHash))?.id;

  const repo: Repo = {
    /* ---------- Negocios ---------- */
    async listBusinesses() { return clone(businesses); },
    async getBusiness(id) { const b = businesses.find((x) => x.id === id); return b ? clone(b) : null; },

    async createBusiness(input: NewBusinessInput) {
      const name = input.name?.trim() ?? '';
      const err = (name.length < 2 && 'Escribe el nombre del negocio.') || validateName(input.ownerName) || validatePin(input.ownerPin);
      if (err) fail(err);
      const base = slugify(name);
      let slug = base; let n = 1;
      while (businesses.some((b) => b.slug === slug)) slug = `${base}-${++n}`;
      let id = `biz_${slug.replace(/-/g, '_')}`;
      while (businesses.some((b) => b.id === id)) id = `${id}_${++seq}`;
      const tpl = getTemplate(input.type);
      const business: Business = {
        id, name, slug, type: input.type, city: input.city?.trim() || undefined, country: 'EC', currency: 'USD',
        timezone: 'America/Guayaquil', plan: 'gratis', createdAt: nowIso()
      };
      const location: Location = { id: newId('loc', id), businessId: id, name: 'Principal', active: true };
      const owner: StaffRec = {
        id: newId('emp', id), businessId: id, name: input.ownerName.trim(), role: 'owner', active: true,
        locationId: location.id, hasPin: true, pinHash: hashPin(input.ownerPin), createdAt: nowIso()
      };
      businesses.push(business); locations.push(location); staff.push(owner);
      programs.push({ businessId: id, ...clone(tpl.program), logoText: initials(name) });
      log(id, owner.id, 'business.create', `Se creó ${name} (${tpl.label}).`);
      return { business: clone(business), ownerId: owner.id };
    },

    async updateBusiness(id, patch) {
      const b = biz(id);
      if (patch.name !== undefined) { if (patch.name.trim().length < 2) fail('Escribe el nombre del negocio.'); b.name = patch.name.trim(); }
      if (patch.city !== undefined) b.city = patch.city.trim() || undefined;
      if (patch.timezone !== undefined) b.timezone = patch.timezone;
      if (patch.type !== undefined) b.type = patch.type;
      log(id, undefined, 'business.update', 'Se actualizaron los datos del negocio.');
      return clone(b);
    },

    /* ---------- Sucursales ---------- */
    async listLocations(businessId) { return clone(locations.filter((l) => l.businessId === businessId)); },
    async upsertLocation(businessId, loc) {
      biz(businessId);
      if (!loc.name?.trim()) fail('Escribe el nombre de la sucursal.');
      const existing = loc.id ? locations.find((l) => l.id === loc.id && l.businessId === businessId) : undefined;
      if (existing) {
        existing.name = loc.name.trim();
        if (loc.address !== undefined) existing.address = loc.address;
        if (loc.active !== undefined) existing.active = loc.active;
        return clone(existing);
      }
      const created: Location = { id: newId('loc', businessId), businessId, name: loc.name.trim(), address: loc.address, active: loc.active ?? true };
      locations.push(created);
      return clone(created);
    },

    /* ---------- Equipo ---------- */
    async listStaff(businessId) { return bizStaff(businessId).map(strip); },

    async upsertStaff(businessId, s, pin, actorId) {
      biz(businessId);
      const nameErr = validateName(s.name);
      if (nameErr) fail(nameErr);
      if (pin !== undefined) { const e = validatePin(pin); if (e) fail(e); }
      const existing = s.id ? staff.find((x) => x.id === s.id && x.businessId === businessId) : undefined;
      let rec: StaffRec;
      if (existing) {
        const role: Role = s.role ?? existing.role;
        const active = s.active ?? existing.active;
        const owners = bizStaff(businessId).filter((x) => x.role === 'owner' && x.active && x.id !== existing.id);
        if ((role !== 'owner' || !active) && existing.role === 'owner' && existing.active && owners.length === 0) {
          fail('El negocio debe tener al menos un dueño activo.');
        }
        existing.name = s.name.trim(); existing.role = role; existing.active = active;
        if ('locationId' in s) existing.locationId = s.locationId;
        rec = existing;
      } else {
        rec = {
          id: newId('emp', businessId), businessId, name: s.name.trim(), role: s.role, active: s.active ?? true,
          locationId: s.locationId, hasPin: false, createdAt: nowIso()
        };
        staff.push(rec);
      }
      if (pin !== undefined) rec.pinHash = hashPin(pin);
      rec.hasPin = !!rec.pinHash;
      log(businessId, actorId, 'staff.update', `${existing ? 'Se actualizó a' : 'Se agregó a'} ${rec.name} (${rec.role === 'owner' ? 'dueño' : rec.role === 'manager' ? 'gerente' : 'cajero'})${pin !== undefined ? ' con PIN nuevo' : ''}.`);
      return strip(rec);
    },

    async verifyStaffPin(businessId, staffId, pin) {
      const s = staff.find((x) => x.id === staffId && x.businessId === businessId);
      return !!s && s.active && /^\d{4}$/.test(pin ?? '') && checkPin(pin, s.pinHash);
    },

    /* ---------- Acceso ---------- */
    async verifyCredentials(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const now = clock();
      const rec = email ? staff.find((s) => s.email === email) : undefined;
      if (!rec) {
        await verifyPassword(password, null); // iguala tiempos
        if (!unknownEmails.lockedFor(email, now)) unknownEmails.fail(email, now);
        return null;
      }
      const locked = !!rec.lockedUntil && rec.lockedUntil > now;
      const ok = await verifyPassword(password, rec.passwordHash);
      if (locked) return null;
      if (!ok) {
        rec.failedLogins = (rec.failedLogins ?? 0) + 1;
        if (rec.failedLogins >= MAX_FAILED_LOGINS) { rec.lockedUntil = now + LOCK_MS; rec.failedLogins = 0; }
        return null;
      }
      rec.failedLogins = 0; rec.lockedUntil = undefined;
      if (!rec.active) return null;
      return { businessId: rec.businessId, staffId: rec.id };
    },

    async isLoginLocked(rawEmail) {
      const email = normalizeEmail(rawEmail);
      const rec = email ? staff.find((s) => s.email === email) : undefined;
      return rec ? !!rec.lockedUntil && rec.lockedUntil > clock() : unknownEmails.lockedFor(email, clock()) > 0;
    },

    async setStaffCredentials(staffId, rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const err = validateEmail(email) ?? validatePassword(password);
      if (err) fail(err);
      const rec = staff.find((s) => s.id === staffId) ?? fail('No encontramos a esa persona del equipo.');
      if (staff.some((s) => s.id !== staffId && s.email === email)) fail('Ese correo ya está en uso.');
      rec.passwordHash = await hashPassword(password);
      rec.email = email; rec.failedLogins = 0; rec.lockedUntil = undefined;
      log(rec.businessId, undefined, 'staff.credentials', `Se configuró el acceso por correo de ${rec.name}.`);
    },

    /* ---------- Programa ---------- */
    async getProgram(businessId) { return clone(prog(businessId)); },
    async updateProgram(businessId, patch, actorId) {
      const p = prog(businessId);
      const err = validateProgramPatch(patch);
      if (err) fail(err);
      const changed = Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined);
      Object.assign(p, clone(patch), { businessId });
      log(businessId, actorId, 'program.update', `Se actualizó la tarjeta (${changed.join(', ')}).`);
      return clone(p);
    },

    /* ---------- Clientes ---------- */
    async listCustomers(businessId, q?: CustomerQuery) {
      return clone(filterCustomers(customers.filter((c) => c.businessId === businessId), prog(businessId), q, new Date(clock())));
    },

    async getCustomerDetail(businessId, customerId): Promise<CustomerDetail | null> {
      const c = findCustomer(businessId, customerId);
      if (!c) return null;
      const now = new Date(clock());
      const row = filterCustomers([c], prog(businessId), undefined, now)[0];
      const claims: Parameters<typeof buildCustomerHistory>[0]['claims'] = [];
      for (const code of bizCodes(businessId)) {
        for (const cl of code.claims) {
          if (cl.customerId === customerId) claims.push({ at: cl.at, voidedAt: cl.voidedAt, ticket: code.ticket, staffName: staffName(code.createdBy), voidedByName: staffName(cl.voidedBy) });
        }
      }
      const reds = redemptions.filter((r) => r.businessId === businessId && r.customerId === customerId).map((r) => ({ at: r.at, staffName: staffName(r.staffId) }));
      return clone({ customer: row, history: buildCustomerHistory({ claims, redemptions: reds }) });
    },

    async updateCustomer(businessId, customerId, patch) {
      const c = findCustomer(businessId, customerId) ?? fail('No encontramos a ese cliente.');
      if (patch.name !== undefined) { const e = validateName(patch.name); if (e) fail(e); c.name = patch.name.trim(); }
      if (patch.contact !== undefined) {
        const v = validateContact(c.contactKind, patch.contact);
        if (!v.ok) fail(v.error);
        else {
          if (customers.some((x) => x.businessId === businessId && x.id !== c.id && x.contact === v.contact)) fail('Ya existe un cliente con ese contacto.');
          c.contact = v.contact;
        }
      }
      if ('notes' in patch) c.notes = patch.notes?.trim() || undefined;
      if ('birthday' in patch) { const e = validateBirthday(patch.birthday); if (e) fail(e); c.birthday = patch.birthday; }
      return clone(c);
    },

    async registerCustomer(businessId, input) {
      biz(businessId);
      const nameErr = validateName(input.name);
      if (nameErr) fail(nameErr);
      const v = validateContact(input.contactKind, input.contact);
      if (!v.ok) return fail(v.error);
      const bErr = validateBirthday(input.birthday);
      if (bErr) fail(bErr);
      if (customers.some((c) => c.businessId === businessId && c.contact === v.contact)) fail('Ya existe un cliente con ese contacto.');
      const at = nowIso();
      const c: Customer = {
        id: newId('cli', businessId), businessId, name: input.name.trim(), contact: v.contact, contactKind: input.contactKind,
        birthday: input.birthday, consentAt: at, createdAt: at, stamps: 0, totalStamps: 0, rewardsRedeemed: 0
      };
      customers.push(c);
      return clone(c);
    },

    /* ---------- Códigos de sello ---------- */
    async createStampCode(businessId, input: NewStampCodeInput): Promise<CreateCodeResult> {
      const business = businesses.find((b) => b.id === businessId);
      if (!business) return { ok: false, error: 'No encontramos ese negocio.' };
      const program = prog(businessId);
      const creator = staff.find((s) => s.id === input.staffId && s.businessId === businessId && s.active);
      if (!creator) return { ok: false, error: 'Esta persona no está activa en este negocio.' };

      const used = new Set(bizCodes(businessId).map((c) => normalizeTicket(c.ticket)));
      const ticket = (input.ticket ?? '').trim();
      const v = validateNewCode(program, { ticket, amountCents: input.amountCents, seats: input.seats }, used);
      if (!v.ok) {
        if (v.field === 'ticket' && ticket) {
          const original = bizCodes(businessId).find((c) => normalizeTicket(c.ticket) === normalizeTicket(ticket));
          reject(businessId, { kind: 'duplicate_ticket', staffId: creator.id, ticket, codeId: original?.id });
        }
        return v;
      }

      let approvedBy: string | undefined;
      if (needsApproval(program, input.seats)) {
        if (!input.approvalPin) return { ok: false, field: 'pin', error: `Más de ${cupos(program.maxSeatsWithoutApproval)} necesita el PIN de un dueño o gerente.` };
        approvedBy = findApprover(businessId, input.approvalPin);
        if (!approvedBy) return { ok: false, field: 'pin', error: 'El PIN no es correcto.' };
      }

      const loc = input.locationId ? locations.find((l) => l.id === input.locationId && l.businessId === businessId && l.active) : undefined;
      const now = clock();
      const live = new Set(bizCodes(businessId).filter((c) => !c.cancelledAt && Date.parse(c.expiresAt) > now && c.claims.length < c.seats).map((c) => c.code));
      const code: StampCode = {
        id: newId('cod', businessId), businessId, locationId: loc?.id ?? creator.locationId,
        code: generateCode(live), ticket, amountCents: program.requireAmount ? input.amountCents : 0, seats: input.seats,
        createdBy: creator.id, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + program.codeTtlSeconds * 1000).toISOString(),
        approvedBy, attempts: 0, claims: []
      };
      codes.push(code);
      log(businessId, creator.id, 'code.create', `Código ${code.code} para el ticket ${ticket}: ${cupos(code.seats)}${approvedBy ? `, aprobado por ${staffName(approvedBy)}` : ''}.`);
      return { ok: true, code: clone(code) };
    },

    async getStampCode(businessId, id) {
      const c = codes.find((x) => x.id === id && x.businessId === businessId);
      return c ? clone(c) : null;
    },

    async listStampCodes(businessId, limit = 50) {
      return clone(bizCodes(businessId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit));
    },

    async cancelStampCode(businessId, id, staffId) {
      const c = codes.find((x) => x.id === id && x.businessId === businessId) ?? fail('No encontramos ese código.');
      if (c.cancelledAt) return;
      c.cancelledAt = nowIso();
      log(businessId, staffId, 'code.cancel', `Se canceló el código ${c.code} (ticket ${c.ticket}).`);
    },

    async claimStampCode(businessId, rawCode, customerId): Promise<ClaimResult> {
      const program = prog(businessId);
      const customer = findCustomer(businessId, customerId);
      if (!customer) return { ok: false, error: 'No encontramos tu tarjeta en este negocio.' };
      const wanted = (rawCode ?? '').trim();
      // Si el número se repitió con el tiempo, manda el código vigente; si no, el más reciente.
      const matches = bizCodes(businessId).filter((c) => c.code === wanted).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const now = new Date(clock());
      const code = matches.find((c) => codeStatus(c, now) === 'activo') ?? matches[0];
      if (!code) return { ok: false, error: 'Ese código no existe. Revisa los 6 dígitos.' };

      const status = codeStatus(code, now);
      if (status === 'cancelado') return { ok: false, error: 'Este código fue cancelado por el negocio.' };
      if (status === 'agotado') {
        code.attempts++;
        reject(businessId, { kind: 'burned_code', codeId: code.id, customerId });
        return { ok: false, error: 'Este código ya se agotó: todos los cupos fueron usados.' };
      }
      if (status === 'vencido') return { ok: false, error: 'Este código venció. Pide uno nuevo en caja.' };
      if (code.claims.some((cl) => cl.customerId === customerId)) return { ok: false, error: 'Ya reclamaste un sello con este código.' };
      if (customer.stamps >= program.stampsRequired) return { ok: false, error: 'Tu tarjeta está completa. Canjea tu premio antes de sumar más sellos.' };

      if (program.cooldownMinutes > 0) {
        let last = 0;
        for (const c of bizCodes(businessId)) for (const cl of c.claims) if (cl.customerId === customerId && !cl.voidedAt) last = Math.max(last, Date.parse(cl.at));
        const readyAt = last + program.cooldownMinutes * 60_000;
        if (last && now.getTime() < readyAt) {
          const mins = Math.ceil((readyAt - now.getTime()) / 60_000);
          reject(businessId, { kind: 'cooldown', customerId, codeId: code.id, minutes: program.cooldownMinutes });
          return { ok: false, error: `Aún no puedes sumar otro sello: espera ${mins} ${mins === 1 ? 'minuto' : 'minutos'}.` };
        }
      }

      code.claims.push({ id: newId('clm', businessId), codeId: code.id, customerId, customerName: customer.name, at: now.toISOString() });
      customer.stamps++; customer.totalStamps++; customer.lastVisitAt = now.toISOString();
      return { ok: true, code: clone(code), customer: clone(customer), rewardReady: customer.stamps >= program.stampsRequired };
    },

    /** Anula un sello. Resta el sello al cliente pero NO devuelve el cupo: el código sigue contando ese reclamo. */
    async voidClaim(businessId, codeId, claimId, staffId) {
      const code = codes.find((c) => c.id === codeId && c.businessId === businessId) ?? fail('No encontramos ese código.');
      const claim = code.claims.find((cl) => cl.id === claimId) ?? fail('No encontramos ese sello.');
      if (!staff.some((s) => s.id === staffId && s.businessId === businessId && s.active)) fail('Esta persona no está activa en este negocio.');
      if (claim.voidedAt) return;
      claim.voidedAt = nowIso(); claim.voidedBy = staffId;
      const c = findCustomer(businessId, claim.customerId);
      if (c) { c.stamps = Math.max(0, c.stamps - 1); c.totalStamps = Math.max(0, c.totalStamps - 1); }
      log(businessId, staffId, 'claim.void', `Se anuló el sello de ${claim.customerName} (ticket ${code.ticket}).`);
    },

    /* ---------- Premios ---------- */
    async listRedeemable(businessId) {
      const rows = filterCustomers(customers.filter((c) => c.businessId === businessId), prog(businessId), { segment: 'por_canjear' }, new Date(clock()));
      return clone(rows);
    },

    async redeemReward(businessId, customerId, staffId) {
      const program = prog(businessId);
      const c = findCustomer(businessId, customerId) ?? fail('No encontramos a ese cliente.');
      if (!staff.some((s) => s.id === staffId && s.businessId === businessId && s.active)) fail('Esta persona no está activa en este negocio.');
      if (c.stamps < program.stampsRequired) fail(`Aún no completa la tarjeta: tiene ${c.stamps} de ${program.stampsRequired} sellos.`);
      c.stamps -= program.stampsRequired; c.rewardsRedeemed++;
      const r: Redemption = { id: newId('can', businessId), businessId, customerId, customerName: c.name, staffId, at: nowIso() };
      redemptions.push(r);
      log(businessId, staffId, 'redeem', `Premio canjeado a ${c.name}: ${program.rewardTitle}.`);
      return clone(r);
    },

    async listRedemptions(businessId, limit = 50) {
      return clone(redemptions.filter((r) => r.businessId === businessId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit));
    },

    /* ---------- Analítica y control ---------- */
    async getDashboard(businessId, range: RangeKey): Promise<DashboardData> { return buildDashboard(range, analytics(businessId)); },
    async getStaffReport(businessId, range: RangeKey): Promise<StaffReportRow[]> { return buildStaffReport(range, analytics(businessId)); },
    async listAlerts(businessId, limit = 50): Promise<Alert[]> {
      return deriveAlerts(businessId, { ...analytics(businessId), rejections: rejections.filter((r) => r.businessId === businessId), program: prog(businessId) }, limit);
    },
    async listAudit(businessId, limit = 50) {
      return clone(audit.filter((a) => a.businessId === businessId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit));
    }
  };

  return repo;
}
