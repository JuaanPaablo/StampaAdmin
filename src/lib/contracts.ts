/**
 * CONTRATOS COMPARTIDOS DE STAMPA.
 * Todos los módulos dependen de este archivo. No lo cambies sin avisar:
 * solo se permite AGREGAR campos opcionales o tipos nuevos, nunca renombrar ni borrar.
 * Fechas siempre en ISO 8601 (string). Dinero siempre en centavos (entero).
 */

export const DEMO_BUSINESS_ID = 'biz_esquina';

export type BusinessType =
  | 'restaurante' | 'cafeteria' | 'gimnasio' | 'floristeria' | 'barberia'
  | 'peluqueria' | 'panaderia' | 'tienda' | 'spa' | 'otro';

export type Role = 'owner' | 'manager' | 'cashier';
export type Plan = 'gratis' | 'negocio' | 'pro';

export interface Business {
  id: string;
  name: string;
  slug: string;
  type: BusinessType;
  city?: string;
  country: string;          // 'EC'
  currency: 'USD';
  timezone: string;         // 'America/Guayaquil'
  plan: Plan;
  createdAt: string;
  /** MVP. Ausente = 'active'. */
  status?: BusinessStatus;
  planExpiresAt?: string;          // vencimiento del plan (lo fija Stampa; el cobro es por WhatsApp)
  suspendedAt?: string;
  setupCompletedAt?: string;
  /** Provincia (Ecuador). `city` guarda el cantón. */
  province?: string;
  /** El plan se renueva solo cada mes al vencer (Stampa cobra por WhatsApp). */
  autoRenew?: boolean;
}

export interface Location {
  id: string;
  businessId: string;
  name: string;
  address?: string;
  active: boolean;
}

export interface Staff {
  id: string;
  businessId: string;
  name: string;
  role: Role;
  active: boolean;
  locationId?: string;
  /** Correo de acceso al panel (minúsculas). El hash de la contraseña nunca sale del repo. */
  email?: string;
  hasPin: boolean;          // el PIN nunca sale del repo (solo sirve para aprobaciones dentro del panel)
  createdAt: string;
  /** MVP. Tiene correo pero todavía no creó su contraseña (invitación pendiente). */
  invitePending?: boolean;
}

/** Diseño de la tarjeta y reglas del programa de sellos. Un programa por negocio. */
export interface Program {
  businessId: string;
  name: string;                    // "Tarjeta de cafés"
  stampsRequired: number;          // 4..20
  rewardTitle: string;             // "Café gratis"
  rewardDescription?: string;
  requireAmount: boolean;          // false en gimnasios: el sello no depende del monto
  minSpendCentsPerStamp: number;   // 250 = $2,50. Se ignora si requireAmount es false
  codeTtlSeconds: number;          // vigencia de cada código (300 = 5 min)
  maxSeatsWithoutApproval: number; // más cupos que esto exige PIN de dueño o gerente
  cooldownMinutes: number;         // 0 = sin límite. Minutos mínimos entre sellos del mismo cliente
  colors: { bg: string; accent: string; ink: string };  // hex
  logoText: string;                // iniciales, ej. "CE"
  logoUrl?: string;
  terms?: string;
  birthdayReward?: string;         // ej. "Un café de regalo en tu cumpleaños"
  rewardExpiresDays?: number;
  /** MVP. Foto de portada de la tarjeta (URL pública). */
  coverUrl?: string;
  /** Premios intermedios antes del final, ordenados por sello: [{ at: 4, title: "Postre gratis" }]. Máximo 3. */
  milestones?: Milestone[];
  /** Encuadre del logo y la portada (posición y zoom). */
  imageFraming?: { logo?: ImageFraming; cover?: ImageFraming };
  /** Diseño del póster con QR. */
  poster?: PosterStyle;
}

export interface Milestone { at: number; title: string }
/** x, y: 0..100 (% de object-position). zoom: 1..3. */
export interface ImageFraming { x: number; y: number; zoom: number }
export type PosterTheme = 'stampa' | 'tarjeta' | 'claro' | 'sol' | 'personal';
export type PosterFont = 'sora' | 'redonda' | 'clasica' | 'impacto' | 'manuscrita';
export interface PosterStyle {
  theme?: PosterTheme;
  font?: PosterFont;
  /** Solo con theme 'personal'. */
  bg?: string;
  accent?: string;
  ink?: string;
  /** Título grande. Vacío = "Pide tu sello aquí". */
  title?: string;
  showReward?: boolean;
}

export type ContactKind = 'whatsapp' | 'email';
export type WalletKind = 'apple' | 'google';

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  contact: string;
  contactKind: ContactKind;
  birthday?: { d: number; m: number };   // m = 0..11
  consentAt: string;
  createdAt: string;
  stamps: number;                  // sellos en la tarjeta actual (0..stampsRequired)
  totalStamps: number;             // de por vida
  rewardsRedeemed: number;
  lastVisitAt?: string;
  wallet?: WalletKind;
  notes?: string;
  /** MVP. Año de nacimiento (el día y mes siguen en birthday). */
  birthdayYear?: number;
  /** MVP. Cuándo confirmó su correo con el código de 6 dígitos. */
  emailVerifiedAt?: string;
  /** Sellos intermedios ya canjeados en la tarjeta actual. */
  milestonesClaimed?: number[];
}

export type CustomerSegment = 'nuevo' | 'activo' | 'en_riesgo' | 'inactivo' | 'por_canjear';
export interface CustomerRow extends Customer { segment: CustomerSegment }

export interface StampClaim {
  id: string;
  codeId: string;
  customerId: string;
  customerName: string;
  at: string;
  voidedAt?: string;
  voidedBy?: string;               // staffId
}

export type CodeStatus = 'activo' | 'agotado' | 'vencido' | 'cancelado';

/** Código de un solo uso por venta, con cupos para grupos. */
export interface StampCode {
  id: string;
  businessId: string;
  locationId?: string;
  code: string;                    // 6 dígitos
  ticket: string;                  // N.º de ticket / factura / ficha. Único por negocio
  amountCents: number;             // 0 si el programa no pide monto
  seats: number;                   // cupos
  createdBy: string;               // staffId
  createdAt: string;
  expiresAt: string;
  approvedBy?: string;             // staffId que aprobó con PIN
  cancelledAt?: string;
  attempts: number;                // intentos rechazados con el código ya quemado
  claims: StampClaim[];
}

export interface Redemption {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  staffId: string;
  at: string;
  /** Sello del premio intermedio; ausente = premio final. */
  milestone?: number;
  rewardTitle?: string;
}

export type AlertKind =
  | 'staff_ratio' | 'shared_code' | 'approval' | 'voids' | 'duplicate_ticket' | 'cooldown';
export type Severity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  businessId: string;
  kind: AlertKind;
  severity: Severity;
  staffId?: string;
  codeId?: string;
  message: string;                 // en español, listo para mostrar
  at: string;
}

export interface AuditEntry {
  id: string;
  businessId: string;
  staffId?: string;
  action: string;                  // 'code.create' | 'claim.void' | 'redeem' | 'program.update' | 'staff.update' ...
  detail: string;
  at: string;
}

export type RangeKey = '7d' | '30d' | '90d';

export interface DashboardData {
  range: RangeKey;
  kpis: {
    stampsIssued: number;
    activeCustomers: number;       // con al menos 1 sello en el rango
    newCustomers: number;
    rewardsRedeemed: number;
    returnRate: number;            // 0..1 clientes con 2+ visitas / clientes activos
    stampsPerTicket: number;
  };
  previous: { stampsIssued: number; activeCustomers: number; newCustomers: number; rewardsRedeemed: number };
  series: { date: string; stamps: number; newCustomers: number }[];
  byHour: { hour: number; stamps: number }[];
  byWeekday: { weekday: number; stamps: number }[];   // 0 = domingo
  topCustomers: { customerId: string; name: string; stamps: number }[];
  upcomingBirthdays: { customerId: string; name: string; d: number; m: number }[];
}

export interface StaffReportRow {
  staffId: string;
  name: string;
  tickets: number;
  stamps: number;
  voids: number;
  ratio: number;                   // sellos por ticket
  flagged: boolean;                // ratio > 1.5 × mediana del equipo, con 5+ tickets
}

/* ---------- Entradas de mutación ---------- */

export interface NewBusinessInput {
  name: string;
  type: BusinessType;
  city?: string;
  ownerName: string;
  ownerPin: string;                // 4 dígitos
}

export interface NewStampCodeInput {
  staffId: string;
  locationId?: string;
  ticket: string;
  amountCents: number;
  seats: number;
  approvalPin?: string;            // PIN de dueño o gerente cuando hace falta
}

export type CreateCodeResult =
  | { ok: true; code: StampCode }
  | { ok: false; error: string; field?: 'ticket' | 'amount' | 'seats' | 'pin' };

export type ClaimResult =
  | { ok: true; code: StampCode; customer: Customer; rewardReady: boolean }
  | { ok: false; error: string };

export interface CustomerQuery {
  search?: string;
  segment?: CustomerSegment | 'todos';
  sort?: 'recientes' | 'sellos' | 'nombre' | 'inactividad';
}

export interface CustomerDetail {
  customer: CustomerRow;
  history: { at: string; kind: 'stamp' | 'redeem' | 'void'; ticket?: string; staffName?: string }[];
}

/* =====================================================================================================
 * MVP (noviembre 2026): panel de administrador de Stampa, invitaciones, asistente del dueño y tarjeta del cliente.
 * Ver docs/MVP.md. Todo lo de aquí abajo es nuevo; los campos agregados a tipos existentes son opcionales.
 * ===================================================================================================== */

/** setup = invitado, el dueño aún no termina el asistente · active = operando · suspended = bloqueado por Stampa. */
export type BusinessStatus = 'setup' | 'active' | 'suspended';

export type AccessTokenKind = 'invite' | 'reset';

/** Enlace de un solo uso. `token` es el valor en claro: solo existe en esta respuesta (en la base se guarda su hash). */
export interface IssuedToken { token: string; kind: AccessTokenKind; expiresAt: string }

export interface AccessTokenInfo {
  kind: AccessTokenKind;
  staffId: string;
  businessId: string;
  email: string;
  staffName: string;
  businessName: string;
  businessStatus: BusinessStatus;
  expiresAt: string;
}

export const INVITE_TTL_HOURS = 72;
export const RESET_TTL_MINUTES = 60;

export interface NewBusinessAccessInput {
  ownerEmail: string;
  plan: Plan;
  planExpiresAt?: string;          // ISO; opcional
  autoRenew?: boolean;
  note?: string;                   // nota interna de Stampa (p. ej. "Pizzería, 5 sucursales")
}

export interface AdminBusinessRow {
  business: Business;
  owner?: { staffId: string; name: string; email?: string; invitePending: boolean };
  note?: string;
  stats: { customers: number; stamps30d: number; redemptions30d: number; lastActivityAt?: string };
}

export interface PlatformSummary {
  businesses: { total: number; active: number; setup: number; suspended: number; expiringSoon: number; expired: number };
  customers: number;
  stamps30d: number;
  stampsTotal: number;
  redemptions30d: number;
  redemptionsTotal: number;
}

export interface AdminAccount { id: string; email: string; createdAt: string; lastLoginAt?: string }

/** Datos que el dueño completa en el asistente de bienvenida. */
export interface BusinessSetupInput { name: string; type: BusinessType; city?: string; province?: string }

/** Lo que ve el cliente en su teléfono. */
export interface CustomerCard {
  business: Business;
  program: Program;
  customer: Customer;
  /** milestone: canje de un premio intermedio (no reinicia la tarjeta). */
  recent: { at: string; kind: 'stamp' | 'redeem'; milestone?: number; title?: string }[];
}

export type OtpRequestResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; error: string };
