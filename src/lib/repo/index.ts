import type {
  Alert, AuditEntry, Business, ClaimResult, CreateCodeResult, Customer, CustomerDetail, CustomerQuery,
  CustomerRow, DashboardData, Location, NewBusinessInput, NewStampCodeInput, Program, RangeKey,
  Redemption, Staff, StaffReportRow, StampCode, Role
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
  updateBusiness(id: string, patch: Partial<Pick<Business, 'name' | 'city' | 'timezone' | 'type'>>): Promise<Business>;

  /* Sucursales */
  listLocations(businessId: string): Promise<Location[]>;
  upsertLocation(businessId: string, loc: Partial<Location> & { name: string }): Promise<Location>;

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
  redeemReward(businessId: string, customerId: string, staffId: string): Promise<Redemption>;
  listRedemptions(businessId: string, limit?: number): Promise<Redemption[]>;

  /* Analítica y control */
  getDashboard(businessId: string, range: RangeKey): Promise<DashboardData>;
  getStaffReport(businessId: string, range: RangeKey): Promise<StaffReportRow[]>;
  listAlerts(businessId: string, limit?: number): Promise<Alert[]>;
  listAudit(businessId: string, limit?: number): Promise<AuditEntry[]>;
}

const g = globalThis as unknown as { __stampaRepo?: Repo };

/** Singleton por proceso. STAMPA_REPO=supabase cambia a la implementación real. */
export function getRepo(): Repo {
  if (!g.__stampaRepo) g.__stampaRepo = process.env.STAMPA_REPO === 'supabase' ? createSupabaseRepo() : createMemoryRepo();
  return g.__stampaRepo;
}
