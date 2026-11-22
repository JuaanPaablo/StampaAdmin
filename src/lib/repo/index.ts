import type {
  Alert, AuditEntry, Business, ClaimResult, CreateCodeResult, Customer, CustomerDetail, CustomerQuery,
  CustomerRow, DashboardData, Location, NewBusinessInput, NewStampCodeInput, Program, RangeKey,
  Redemption, Staff, StaffReportRow, StampCode, Role,
  AccessTokenInfo, AccessTokenKind, AdminAccount, AdminBusinessRow, BusinessSetupInput, BusinessStatus, CustomerCard,
  IssuedToken, NewBusinessAccessInput, OtpRequestResult, Plan, PlatformSummary,
  MarketingGeneration, MarketingKind, MarketingPhoto, MarketingUsage, NewMarketingGeneration
} from '../contracts';
import { createMemoryRepo } from './memory';
import { createSupabaseRepo } from './supabase';

/**
 * Capa de datos. TODA la interfaz del panel habla con esta interfaz y nunca con la base directamente.
 * Hay dos implementaciones: memory.ts (datos de ejemplo, para desarrollo y demos) y supabase.ts (producción).
 * Las reglas de negocio viven en src/lib/domain y las usan ambas implementaciones.
 */
export interface Repo {
  /* Negocios */
  listBusinesses(): Promise<Business[]>;
  getBusiness(id: string): Promise<Business | null>;
  /** Crea negocio + programa con la plantilla del tipo + dueño. Devuelve el negocio y el staffId del dueño. */
  createBusiness(input: NewBusinessInput): Promise<{ business: Business; ownerId: string }>;
  updateBusiness(id: string, patch: Partial<Pick<Business, 'name' | 'city' | 'province' | 'timezone' | 'type'>>): Promise<Business>;

  /* Sucursales */
  /** Sin las eliminadas, en orden de creación. */
  listLocations(businessId: string): Promise<Location[]>;
  /** Crear una nueva respeta el límite del plan (PLAN_MAX_LOCATIONS). */
  upsertLocation(businessId: string, loc: Partial<Location> & { name: string }): Promise<Location>;
  /** La oculta para siempre (el historial de sellos la conserva). Debe quedar al menos una. */
  deleteLocation(businessId: string, id: string, actorId?: string): Promise<void>;

  /* Equipo */
  listStaff(businessId: string): Promise<Staff[]>;
  /** pin: si viene, se reemplaza. Debe tener 4 dígitos. */
  upsertStaff(businessId: string, s: Partial<Staff> & { name: string; role: Role }, pin?: string, actorId?: string): Promise<Staff>;
  /** El PIN ya NO es credencial de entrada: solo se usa para aprobaciones dentro del panel. */
  verifyStaffPin(businessId: string, staffId: string, pin: string): Promise<boolean>;

  /* Acceso (correo + contraseña) */
  /**
   * Valida correo (minúsculas, sin espacios) y contraseña de una persona ACTIVA. Siempre ejecuta una verificación de hash,
   * exista o no el correo. Cuenta los fallos: 5 seguidos bloquean la cuenta 15 minutos. Devuelve null ante cualquier fallo.
   */
  verifyCredentials(email: string, password: string): Promise<{ businessId: string; staffId: string } | null>;
  /** true si el correo está bloqueado por intentos fallidos (igual para correos que no existen). */
  isLoginLocked(email: string): Promise<boolean>;
  /** Provisión por el equipo de Stampa: fija correo y contraseña (mínimo 10 caracteres) y limpia bloqueos. */
  setStaffCredentials(staffId: string, email: string, password: string): Promise<void>;

  /* Programa y tarjeta */
  getProgram(businessId: string): Promise<Program>;
  updateProgram(businessId: string, patch: Partial<Omit<Program, 'businessId'>>, actorId?: string): Promise<Program>;

  /* Clientes */
  listCustomers(businessId: string, q?: CustomerQuery): Promise<CustomerRow[]>;
  getCustomerDetail(businessId: string, customerId: string): Promise<CustomerDetail | null>;
  updateCustomer(businessId: string, customerId: string, patch: Partial<Pick<Customer, 'name' | 'contact' | 'notes' | 'birthday'>>): Promise<Customer>;
  /** Registro de un cliente nuevo (lo que haría el formulario de la primera visita). */
  registerCustomer(businessId: string, c: Pick<Customer, 'name' | 'contact' | 'contactKind'> & { birthday?: Customer['birthday'] }): Promise<Customer>;

  /* Códigos de sello */
  createStampCode(businessId: string, input: NewStampCodeInput): Promise<CreateCodeResult>;
  getStampCode(businessId: string, id: string): Promise<StampCode | null>;
  listStampCodes(businessId: string, limit?: number): Promise<StampCode[]>;
  cancelStampCode(businessId: string, id: string, staffId: string): Promise<void>;
  /** Lo que haría el cliente al escanear. El panel lo usa para simular. Debe ser atómico. */
  claimStampCode(businessId: string, code: string, customerId: string): Promise<ClaimResult>;
  /** Intento de un tercero con un código ya quemado (suma attempts). Devuelve el mensaje de rechazo. */
  voidClaim(businessId: string, codeId: string, claimId: string, staffId: string): Promise<void>;

  /* Premios */
  listRedeemable(businessId: string): Promise<CustomerRow[]>;
  /** milestone: sello del premio intermedio; sin él, el premio final. */
  redeemReward(businessId: string, customerId: string, staffId: string, milestone?: number): Promise<Redemption>;
  listRedemptions(businessId: string, limit?: number): Promise<Redemption[]>;

  /* Analítica y control */
  getDashboard(businessId: string, range: RangeKey): Promise<DashboardData>;
  getStaffReport(businessId: string, range: RangeKey): Promise<StaffReportRow[]>;
  listAlerts(businessId: string, limit?: number): Promise<Alert[]>;
  listAudit(businessId: string, limit?: number): Promise<AuditEntry[]>;

  /* =============================== MVP (ver docs/MVP.md) =============================== */

  /* Plataforma: panel de administrador de Stampa */
  /**
   * Autoriza un correo como dueño de un negocio NUEVO. Crea el negocio en estado 'setup' (nombre provisional
   * "Negocio nuevo", slug provisional), su programa con la plantilla 'otro' y la persona dueña con ese correo y SIN
   * contraseña. Devuelve también la invitación (72 h). Falla si el correo ya pertenece a alguien.
   */
  createBusinessAccess(input: NewBusinessAccessInput): Promise<{ business: Business; ownerId: string; invite: IssuedToken }>;
  listAdminBusinesses(): Promise<AdminBusinessRow[]>;
  getAdminBusiness(id: string): Promise<AdminBusinessRow | null>;
  getPlatformSummary(): Promise<PlatformSummary>;
  /** Solo 'active' | 'suspended'. Reactivar un negocio que nunca terminó el asistente lo devuelve a 'setup'. */
  setBusinessStatus(id: string, status: Exclude<BusinessStatus, 'setup'>): Promise<Business>;
  /** planExpiresAt null = sin vencimiento. note / autoRenew undefined = no cambia. */
  updateBusinessPlan(id: string, plan: Plan, planExpiresAt: string | null, note?: string, autoRenew?: boolean): Promise<Business>;

  /* Cuentas de administrador (tabla aparte del equipo de los negocios) */
  verifyAdminCredentials(email: string, password: string): Promise<{ adminId: string } | null>;
  isAdminLoginLocked(email: string): Promise<boolean>;
  getAdmin(id: string): Promise<AdminAccount | null>;
  /** Crea o reemplaza la contraseña de un admin por correo (lo usa el script de alta). */
  upsertAdmin(email: string, password: string): Promise<AdminAccount>;
  /** Cambia la contraseña verificando la actual. Lanza Error con mensaje en español si no coincide. */
  changeAdminPassword(adminId: string, currentPassword: string, newPassword: string): Promise<void>;

  /* Enlaces de un solo uso (invitación y restablecer contraseña) */
  /** Invalida los enlaces anteriores sin usar del mismo tipo para esa persona y emite uno nuevo. */
  issueAccessToken(staffId: string, kind: AccessTokenKind): Promise<IssuedToken>;
  /** Información del enlace si es válido (existe, no vencido, no usado, persona activa); si no, null. */
  peekAccessToken(token: string): Promise<AccessTokenInfo | null>;
  /** Usa el enlace: fija la contraseña (y el nombre si viene), lo marca usado y limpia bloqueos. Lanza si no es válido. */
  consumeAccessToken(token: string, password: string, name?: string): Promise<{ businessId: string; staffId: string }>;
  /** Persona ACTIVA con ese correo (para "olvidé mi contraseña"), o null. */
  findStaffByEmail(email: string): Promise<Staff | null>;
  /** Asigna o cambia el correo de acceso de alguien del equipo (único en toda la plataforma). */
  setStaffEmail(businessId: string, staffId: string, email: string, actorId?: string): Promise<Staff>;

  /* Asistente de bienvenida del dueño */
  /**
   * Guarda nombre, tipo y ciudad. Mientras el negocio esté en 'setup' regenera el slug desde el nombre y, si cambia el
   * tipo, reaplica la plantilla de la tarjeta. Después de activarse el slug ya NO cambia (el QR impreso depende de él).
   */
  saveBusinessSetup(businessId: string, input: BusinessSetupInput, actorId?: string): Promise<Business>;
  /** Pasa de 'setup' a 'active' (exige nombre real y al menos una sucursal activa). */
  completeBusinessSetup(businessId: string, actorId?: string): Promise<Business>;
  /** Imágenes del negocio. Devuelve la URL pública. kind: 'logo' | 'cover'. Máx. 2 MB, png/jpeg/webp. */
  uploadBusinessImage(businessId: string, kind: 'logo' | 'cover', file: { bytes: Uint8Array; contentType: string }): Promise<string>;

  /* Clientes (página pública /u/<slug>) */
  getBusinessBySlug(slug: string): Promise<Business | null>;
  findCustomerByEmail(businessId: string, email: string): Promise<Customer | null>;
  /** Tarjetas de ese correo en todos los negocios ACTIVOS o suspendidos (las suspendidas se muestran congeladas). */
  listCustomerCards(email: string): Promise<CustomerCard[]>;
  getCustomerCard(businessId: string, customerId: string): Promise<CustomerCard | null>;
  /**
   * Alta desde la página pública: contacto = correo ya verificado. Si ya existe en ese negocio devuelve el existente.
   * Guarda emailVerifiedAt y consentAt.
   */
  registerVerifiedCustomer(businessId: string, input: { name: string; email: string; birthday: { d: number; m: number }; birthdayYear?: number }): Promise<Customer>;
  /** Código de 6 dígitos para un correo. Máx. 5 por correo por hora; vence en 10 min. Devuelve el código en claro para enviarlo. */
  requestEmailOtp(email: string): Promise<OtpRequestResult>;
  /** true si el código es correcto y vigente (lo consume). Máx. 5 intentos por código. */
  verifyEmailOtp(email: string, code: string): Promise<boolean>;

  /* ---------- Marketing ---------- */
  recordMarketing(businessId: string, g: NewMarketingGeneration): Promise<MarketingGeneration>;
  /** Generaciones desde `sinceIso` (para el límite mensual del plan). `kinds` filtra por tipo. */
  countMarketingSince(businessId: string, sinceIso: string, kinds?: MarketingKind[]): Promise<number>;
  /** Guarda una foto para posts (bucket branding, carpeta <negocio>/marketing). */
  uploadMarketingPhoto(businessId: string, file: { bytes: Uint8Array; contentType: string }): Promise<MarketingPhoto>;
  /** Fotos recientes del negocio, la más nueva primero. */
  listMarketingPhotos(businessId: string, limit?: number): Promise<MarketingPhoto[]>;
  /** URL de una foto del negocio, o null si el id no es válido o no existe. */
  marketingPhotoUrl(businessId: string, photoId: string): Promise<string | null>;
  listMarketing(businessId: string, limit?: number): Promise<MarketingGeneration[]>;
  /** Uso por negocio desde `sinceIso` (panel de administrador). */
  marketingUsage(sinceIso: string, businessId?: string): Promise<Record<string, MarketingUsage>>;
}

const g = globalThis as unknown as { __stampaRepo?: Repo };

/** Singleton por proceso. STAMPA_REPO=supabase cambia a la implementación real. */
export function getRepo(): Repo {
  // En producción de Vercel el repo en memoria perdería datos reales entre instancias: mejor fallar a la vista.
  if (!g.__stampaRepo && process.env.VERCEL_ENV === 'production' && process.env.STAMPA_REPO !== 'supabase') {
    throw new Error('Producción sin base de datos: define STAMPA_REPO=supabase y SUPABASE_SERVICE_ROLE_KEY en Vercel.');
  }
  if (!g.__stampaRepo) g.__stampaRepo = process.env.STAMPA_REPO === 'supabase' ? createSupabaseRepo() : createMemoryRepo();
  return g.__stampaRepo;
}
