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
export type Plan = 'basico' | 'standard' | 'pro';

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
  stats: {
    customers: number; stamps30d: number; redemptions30d: number; lastActivityAt?: string;
    /** Sellos (no anulados) de los últimos 7 días. */
    stamps7d?: number;
    /** Último sello no anulado (lastActivityAt también cuenta canjes). */
    lastStampAt?: string;
  };
  /** Celular del dueño para WhatsApp, en E.164 ("+593991234567"). Ver src/lib/phone.ts. */
  ownerPhone?: string;
  /** Vencimiento del último enlace de invitación sin usar del dueño (solo si la invitación sigue pendiente). */
  inviteExpiresAt?: string;
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

/* ---------- Marketing ---------- */

export type MarketingKind = 'post' | 'data_post' | 'calendar' | 'review_reply' | 'photo_edit';

/** Una generación con IA: queda guardada para el historial, el límite mensual y el costo. */
export interface MarketingGeneration {
  id: string;
  businessId: string;
  staffId?: string;
  kind: MarketingKind;
  topic?: string;
  output: unknown;
  model?: string;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  createdAt: string;
}

export interface NewMarketingGeneration {
  staffId?: string;
  kind: MarketingKind;
  topic?: string;
  output: unknown;
  model?: string;
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
}

export interface MarketingUsage { count: number; promptTokens: number; cachedTokens: number; completionTokens: number }

/** Foto subida (o mejorada con IA) para los posts de Marketing. */
export interface MarketingPhoto { id: string; url: string; createdAt: string }

/* =====================================================================================================
 * Panel de administrador: métricas de la plataforma, cobros, historial de acciones y teléfono del dueño
 * (migración 0009_admin_insights.sql). Lógica pura en src/lib/domain/admin-insights.ts.
 * Todas las fechas de calendario (días, semanas, meses) se calculan en America/Guayaquil.
 * ===================================================================================================== */

/**
 * Semáforo de actividad de un negocio:
 * green = sellos en los últimos 7 días · yellow = último sello hace 7 a 14 días · red = más de 14 días (o nunca)
 * · none = no aplica (configurando o suspendido). Un negocio activo sin sellos cuenta desde que terminó el asistente.
 */
export type BusinessHealth = 'green' | 'yellow' | 'red' | 'none';

/** Qué hay que hacer hoy con un negocio (lista "Hoy te toca"). */
export type AdminTaskKind =
  | 'payment_due'      // el plan vence en 7 días o menos (cobrar)
  | 'plan_expired'     // el plan ya venció y no se renovó (activo o configurando)
  | 'inactive'         // activo, sin sellos hace más de 7 días
  | 'setup_stuck'      // ya creó su contraseña pero lleva más de 3 días en el asistente
  | 'invite_expired';  // la invitación (72 h) venció sin que el dueño entrara

export interface AdminTask {
  /** Clave estable para React: `${kind}:${businessId}`. */
  id: string;
  kind: AdminTaskKind;
  businessId: string;
  /** Nombre para mostrar (los que están configurando dicen "Negocio nuevo · configurando"). */
  businessName: string;
  /** Etiqueta corta para el distintivo: "Vence en 3 días", "Vencido", "Sin sellos", "Atascado", "Invitación vencida". */
  label: string;
  /** Frase completa en español: "El plan Standard vence el 28 nov 2026. Cobra $54,99." */
  reason: string;
  severity: Severity;
  /** Fecha que origina la tarea (vencimiento, último sello, alta o vencimiento de la invitación). ISO. */
  at?: string;
  /** Días respecto a `at` (positivo = faltan, negativo = pasaron), en días calendario de Ecuador. */
  days?: number;
  /** Precio mensual del plan (centavos) en tareas de cobro. */
  amountCents?: number;
  ownerEmail?: string;
  /** E.164; con él la interfaz arma el enlace de WhatsApp (ownerWhatsappUrl en src/lib/urls.ts). */
  ownerPhone?: string;
}

/** Punto de una serie de tiempo rellenada con ceros. */
export interface SeriesPoint {
  /** 'YYYY-MM-DD' (día, o lunes de la semana) o 'YYYY-MM' (mes), en hora de Ecuador. */
  key: string;
  /** Etiqueta corta en español: "25 nov", "23 nov" (lunes de la semana), "nov 2026". */
  label: string;
  value: number;
}

/** Un negocio en una lista de dinero (renovaciones o ingreso en riesgo). */
export interface MoneyLine {
  businessId: string;
  businessName: string;
  status: BusinessStatus;
  plan: Plan;
  /** Precio mensual del plan, centavos. */
  amountCents: number;
  /** Vencimiento del plan (ISO). */
  date: string;
  /** Días calendario hasta el vencimiento (negativo = vencido hace N días). */
  days: number;
  autoRenew: boolean;
  ownerPhone?: string;
}

export interface PlanBreakdown { plan: Plan; label: string; count: number; mrrCents: number }

/** Un negocio en el semáforo y en los rankings. */
export interface BusinessActivity {
  businessId: string;
  businessName: string;
  slug: string;
  status: BusinessStatus;
  plan: Plan;
  health: BusinessHealth;
  lastStampAt?: string;
  /** Días calendario desde el último sello (null = nunca selló). */
  daysSinceLastStamp: number | null;
  stamps7d: number;
  stamps30d: number;
  customers: number;
  ownerPhone?: string;
}

/** Uso de IA de un negocio en el mes (proveedores: DeepSeek para textos, fal.ai para fotos). */
export interface AiCostRow {
  businessId: string;
  businessName: string;
  plan: Plan;
  /** Generaciones de texto (post, data_post, calendar, review_reply). */
  texts: number;
  /** Fotos mejoradas (photo_edit). */
  images: number;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  /** Costo estimado en dólares (ver AI_PRICES en src/lib/domain/admin-insights.ts). */
  costUsd: number;
  /** Precio mensual del plan en dólares. */
  planPriceUsd: number;
  /** costUsd / planPriceUsd. 0,05 = la IA se come el 5 % del plan. */
  ratio: number;
}

/** Uso de IA en bruto de un negocio (entrada de aiCost). */
export interface AiUsage { texts: number; images: number; promptTokens: number; cachedTokens: number; completionTokens: number }

/** Todo lo que muestra el resumen del panel de administrador, en una sola llamada (repo.getAdminInsights). */
export interface AdminInsights {
  generatedAt: string;
  /** Lista "Hoy te toca", ordenada por gravedad (critical primero) y luego por urgencia. */
  tasks: AdminTask[];
  money: {
    /**
     * Ingreso mensual recurrente estimado: suma del precio del plan de los negocios ACTIVOS con el plan al día
     * (sin vencimiento o vencimiento futuro). No cuenta 'setup' ni 'suspended' ni planes vencidos.
     */
    mrrCents: number;
    /** Negocios que suman al MRR. */
    payingCount: number;
    /** Siempre los tres planes, en orden Básico, Standard, Pro (count y mrrCents de los que suman al MRR). */
    byPlan: PlanBreakdown[];
    /** Vencen en los próximos 30 días (negocios no suspendidos), del más próximo al más lejano. */
    upcomingRenewals: { items: MoneyLine[]; totalCents: number };
    /** Ingreso en riesgo: negocios activos o suspendidos con el plan vencido (el vencido hace más tiempo primero). */
    atRisk: { items: MoneyLine[]; totalCents: number };
    /** Pagos registrados con fecha de pago en el mes calendario actual. */
    collectedThisMonthCents: number;
    /** Cobrado por mes (value en centavos), últimos 6 meses (incluye el actual), del más antiguo al más nuevo. */
    collectedByMonth: SeriesPoint[];
  };
  health: {
    counts: Record<BusinessHealth, number>;
    /** Todos los negocios, ordenados: red, yellow, green, none; dentro, por días sin sellos (más primero). */
    businesses: BusinessActivity[];
  };
  /** Negocios activos por sellos en los últimos 30 días (top: más sellos primero; bottom: menos primero, sin repetir top). */
  ranking: { top: BusinessActivity[]; bottom: BusinessActivity[] };
  series: {
    /** Negocios nuevos por mes, 12 meses (incluye el actual). */
    businessesByMonth: SeriesPoint[];
    /** Clientes nuevos por semana (lunes a domingo), 12 semanas (incluye la actual). */
    customersByWeek: SeriesPoint[];
    /** Sellos no anulados por día, 90 días (incluye hoy). Para 30 días usa .slice(-30). */
    stampsByDay: SeriesPoint[];
    /** Canjes por día, 90 días (incluye hoy). */
    redemptionsByDay: SeriesPoint[];
  };
  ai: {
    /** Inicio del mes actual en Ecuador (ISO). */
    since: string;
    totalCostUsd: number;
    /** Solo negocios con uso en el mes, del más caro al más barato. */
    businesses: AiCostRow[];
  };
}

/* ---------- Cobros ---------- */

export type PaymentMethod = 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';

export interface AdminPayment {
  id: string;
  businessId: string;
  amountCents: number;
  /** Día del pago, 'YYYY-MM-DD' (calendario de Ecuador). */
  paidAt: string;
  /** Plan que se pagó (el del negocio al registrar, salvo que se indique otro). */
  plan: Plan;
  /** Meses que cubre (null si se fijó la fecha a mano). */
  months: number | null;
  /** Vencimiento antes de registrar el pago (ISO; ausente = no tenía). */
  previousExpiresAt?: string;
  /** Vencimiento después de registrar el pago (ISO). */
  newExpiresAt: string;
  method: PaymentMethod;
  note?: string;
  /** adminId que lo registró. */
  createdBy?: string;
  createdAt: string;
}

/**
 * Registrar un pago. Extiende planExpiresAt:
 *  - con `months` (1..24; por defecto 1): max(vencimiento actual, día del pago) + N meses, al final del día en Ecuador;
 *  - con `newExpiresAt` ('YYYY-MM-DD' o ISO): esa fecha (al final del día en Ecuador si viene sin hora).
 * No cambia el estado del negocio (no reactiva) ni su plan.
 */
export interface NewPaymentInput {
  businessId: string;
  /** Centavos, entero > 0. */
  amountCents: number;
  /** 'YYYY-MM-DD'; no puede ser futuro. */
  paidAt: string;
  method: PaymentMethod;
  months?: number;
  newExpiresAt?: string;
  /** Por defecto, el plan actual del negocio. Solo se registra; no cambia el plan. */
  plan?: Plan;
  /** Máx. 500 letras. */
  note?: string;
  /** adminId de la sesión. */
  createdBy?: string;
}

/* ---------- Historial de acciones del admin ---------- */

export type AdminActionKind =
  | 'access_created' | 'suspended' | 'reactivated' | 'plan_changed' | 'expiry_changed'
  | 'payment_recorded' | 'access_resent' | 'note_changed' | 'phone_changed';

export interface AdminAction {
  id: string;
  businessId: string;
  adminId?: string;
  /** Correo del admin (si la cuenta sigue existiendo). */
  adminEmail?: string;
  kind: AdminActionKind;
  /** Datos de la acción, p. ej. { from: 'basico', to: 'pro' }. Ver adminActionSummary para las claves por tipo. */
  detail: Record<string, unknown>;
  /** Frase lista para mostrar: "Cambió el plan de Básico a Pro." */
  summary: string;
  createdAt: string;
}

export interface NewAdminActionInput {
  businessId: string;
  adminId?: string;
  kind: AdminActionKind;
  detail?: Record<string, unknown>;
}

/* ---------- Detalle de un negocio para el admin ---------- */

export interface AdminStaffRow {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  email?: string;
  /** Ya creó su contraseña (puede entrar al panel). */
  hasPassword: boolean;
  invitePending: boolean;
  createdAt: string;
}

export interface AdminBusinessDetail {
  row: AdminBusinessRow;
  health: BusinessHealth;
  /** Días calendario desde el último sello (null = nunca). */
  daysSinceLastStamp: number | null;
  program: Program | null;
  /** Sucursales vigentes (sin las eliminadas). */
  locations: Location[];
  staff: AdminStaffRow[];
  /** Alertas antifraude de los últimos 60 días (las mismas de /panel/control). recent: hasta 10, la más nueva primero. */
  alerts: { total: number; critical: number; warning: number; recent: Alert[] };
  /** 90 días, incluye hoy. Para 30 días usa .slice(-30). */
  stampsByDay: SeriesPoint[];
  redemptionsByDay: SeriesPoint[];
  customers: number;
  /** Pagos, del más reciente al más antiguo. */
  payments: AdminPayment[];
  /** Historial de acciones del admin, del más reciente al más antiguo (máx. 50). */
  actions: AdminAction[];
  /** Uso de IA del mes actual. */
  ai: AiCostRow;
}
