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
  hasPin: boolean;          // el PIN nunca sale del repo
  createdAt: string;
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
