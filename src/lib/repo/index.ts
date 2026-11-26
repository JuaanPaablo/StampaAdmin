import type {
  Alert, AuditEntry, Business, ClaimResult, CreateCodeResult, Customer, CustomerDetail, CustomerQuery,
  CustomerRow, DashboardData, Location, NewBusinessInput, NewStampCodeInput, Program, RangeKey,
  Redemption, Staff, StaffReportRow, StampCode, Role,
  AccessTokenInfo, AccessTokenKind, AdminAccount, AdminBusinessRow, BusinessSetupInput, BusinessStatus, CustomerCard,
  IssuedToken, NewBusinessAccessInput, OtpRequestResult, Plan, PlatformSummary, WalletKind,
  MarketingGeneration, MarketingKind, MarketingPhoto, MarketingUsage, NewMarketingGeneration,
  AdminAction, AdminBusinessDetail, AdminInsights, AdminPayment, NewAdminActionInput, NewPaymentInput,
  AppleRegistration, CustomerOfferDetail, CustomerOfferWithOffer, GiftCard, GiftCardMovement, GiftCardResult, GiftCardStatus,
  GiftCardOpOptions, IssueGiftCardInput, NewOfferInput, NewWalletNotification, Offer, OfferStats
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
  /** Marca en la ficha del cliente que agregó la tarjeta a su billetera (Apple o Google). */
  setCustomerWallet(businessId: string, customerId: string, wallet: WalletKind): Promise<void>;
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
  /** Completa un registro reservado (modelo y resultado) o lo borra si la generación falló. */
  finishMarketing(businessId: string, id: string, patch: { output?: unknown; model?: string } | null): Promise<void>;
  /** Uso por negocio desde `sinceIso` (panel de administrador). */
  marketingUsage(sinceIso: string, businessId?: string): Promise<Record<string, MarketingUsage>>;

  /* ---------- Panel de administrador: métricas, cobros, historial y teléfono (0009_admin_insights.sql) ---------- */
  /**
   * Todo el resumen del admin en una sola llamada: "Hoy te toca", dinero (MRR, renovaciones, en riesgo, cobrado),
   * semáforo, top/bottom 5, series (12 meses, 12 semanas, 90 días) y costo de IA del mes. Ver AdminInsights.
   * `now` solo para pruebas (por defecto, el reloj del repo).
   */
  getAdminInsights(now?: Date): Promise<AdminInsights>;
  /** Detalle completo de un negocio (fila, sucursales, equipo, alertas, sellos por día, pagos, acciones, IA) o null. */
  getAdminBusinessDetail(id: string): Promise<AdminBusinessDetail | null>;
  /**
   * Registra un pago y extiende el vencimiento del plan (ver NewPaymentInput y nextPlanExpiry). No cambia el estado ni
   * el plan del negocio. Registra también la acción 'payment_recorded' (con input.createdBy como admin).
   * Lanza Error con mensaje en español si los datos no son válidos o el negocio no existe.
   */
  recordPayment(input: NewPaymentInput): Promise<{ payment: AdminPayment; business: Business }>;
  /** Pagos de un negocio, del más reciente (por día de pago) al más antiguo. limit por defecto 100. */
  listPayments(businessId: string, limit?: number): Promise<AdminPayment[]>;
  /** Guarda una acción del admin en el historial del negocio. Lanza si el negocio no existe. */
  logAdminAction(input: NewAdminActionInput): Promise<AdminAction>;
  /** Historial del negocio, la más reciente primero. limit por defecto 50. */
  listAdminActions(businessId: string, limit?: number): Promise<AdminAction[]>;
  /**
   * Celular del dueño para WhatsApp. Lo valida y normaliza a E.164 (normalizeEcPhone en src/lib/phone.ts);
   * null o '' lo borra. Devuelve lo guardado. Lanza Error (PHONE_ERROR) si no es un celular de Ecuador.
   * No registra la acción: la server action llama a logAdminAction('phone_changed').
   */
  setOwnerPhone(businessId: string, phone: string | null): Promise<string | null>;

  /* ---------- Tarjetas extra en Wallet: cupones, gift cards, cercanía y Apple (0010_wallet_cards.sql, docs/TARJETAS.md) ----------
   * Reglas comunes:
   *  - Los errores de reglas de negocio lanzan Error con el mensaje en español listo para mostrar.
   *  - `staffId` debe ser una persona ACTIVA del negocio. Crear/editar/enviar/terminar cupones y vender/recargar/anular
   *    gift cards exige dueño o gerente; canjear cupones y cobrar gift cards, cualquier persona del equipo.
   *  - Crear, enviar, vender y recargar exigen features(plan).offers / .giftCards; canjear, cobrar, anular y terminar
   *    funcionan aunque el negocio haya bajado de plan (lo ya emitido sigue valiendo).
   *  - Todo canje y movimiento queda en el registro de actividad (listAudit): offer.create, offer.update, offer.send,
   *    offer.end, offer.redeem, gift.issue, gift.topup, gift.charge, gift.void, location.coords.
   */

  /** Coordenadas de una sucursal (null las borra). Valida rangos (lat -90..90, long -180..180). */
  setLocationCoords(businessId: string, locationId: string, coords: { latitude: number; longitude: number } | null, actorId?: string): Promise<Location>;

  /** Cupones del negocio, el más reciente primero. */
  listOffers(businessId: string): Promise<Offer[]>;
  getOffer(businessId: string, id: string): Promise<Offer | null>;
  /** Crea un cupón en borrador (validateOffer). Exige plan con cupones y dueño o gerente. */
  createOffer(businessId: string, input: NewOfferInput, staffId: string): Promise<Offer>;
  /** Edita un borrador (los enviados no se editan). Exige plan con cupones y dueño o gerente. */
  updateOffer(businessId: string, id: string, patch: Partial<NewOfferInput>, staffId: string): Promise<Offer>;
  /**
   * Envía un borrador: crea un cupón para CADA cliente del negocio (sin duplicar) y lo marca 'sent', de forma atómica.
   * Exige plan con cupones, dueño o gerente, que no haya terminado ya su vigencia y que queden campañas este mes
   * (features(plan).pushCampaigns menos countCampaignsThisMonth). Devuelve los ids de los clientes que lo recibieron
   * (Wallet y avisos van después, por tandas: syncOfferBatch). No avisa ni sincroniza Wallet aquí.
   */
  sendOffer(businessId: string, id: string, staffId: string): Promise<{ offer: Offer; customerIds: string[] }>;
  /**
   * Página de cupones de clientes de una oferta, ordenados por id y después de `afterId` (cursor). `unredeemedOnly`:
   * solo los sin usar. `total` = todos los que cumplen el filtro (para mostrar el progreso). Lo usa el envío por tandas
   * de Wallet (syncOfferBatch).
   */
  listCustomerOfferPage(businessId: string, offerId: string, opts: { afterId?: string; limit: number; unredeemedOnly?: boolean }): Promise<{ items: { id: string; customerId: string }[]; total: number }>;
  /** Termina un cupón (borrador o enviado): ya no se muestra ni se canjea. Dueño o gerente; no exige plan. */
  endOffer(businessId: string, id: string, staffId: string): Promise<Offer>;
  /** Entregados y canjeados por cupón (todas las ofertas del negocio, o solo `offerId`), por id de oferta. */
  offerStats(businessId: string, offerId?: string): Promise<Record<string, OfferStats>>;
  /** Cupón de un cliente por su id (lo que lee Caja del QR), con la oferta y el nombre del cliente, o null. */
  findCustomerOffer(businessId: string, id: string): Promise<CustomerOfferDetail | null>;
  /** Canjea un cupón de cliente una sola vez (atómico). Valida vigencia (customerOfferRedeemError). No exige plan. */
  redeemCustomerOffer(businessId: string, customerOfferId: string, staffId: string, locationId?: string): Promise<CustomerOfferWithOffer>;

  /** Gift cards del negocio, la más reciente primero. Filtros opcionales por cliente y estado. */
  listGiftCards(businessId: string, opts?: { customerId?: string; status?: GiftCardStatus }): Promise<GiftCard[]>;
  getGiftCard(businessId: string, id: string): Promise<GiftCard | null>;
  /** Busca por código (acepta minúsculas, espacios y guiones: normalizeGiftCardCode). null si no es de este negocio. */
  findGiftCardByCode(businessId: string, code: string): Promise<GiftCard | null>;
  /** Vende una gift card con código nuevo único. Exige plan Pro (giftCards) y dueño o gerente. */
  issueGiftCard(businessId: string, input: IssueGiftCardInput): Promise<GiftCardResult>;
  /** Recarga (suma saldo, tope US$500). Exige plan con gift cards y dueño o gerente. */
  topupGiftCard(businessId: string, giftCardId: string, amountCents: number, staffId: string, opts?: GiftCardOpOptions): Promise<GiftCardResult>;
  /** Cobra (resta saldo; nunca queda negativo). Cualquier persona del equipo; no exige plan. */
  chargeGiftCard(businessId: string, giftCardId: string, amountCents: number, staffId: string, opts?: GiftCardOpOptions): Promise<GiftCardResult>;
  /** Anula: deja el saldo en 0 y el estado 'void'. Dueño o gerente; no exige plan. */
  voidGiftCard(businessId: string, giftCardId: string, staffId: string, note?: string, requestId?: string): Promise<GiftCardResult>;
  /**
   * Idempotencia de venta, recarga, cobro y anulación: si ya existe un movimiento con ese requestId en el negocio,
   * devuelve la gift card actual y ese movimiento (la operación ya se hizo); si no, null.
   * Las cuatro operaciones de arriba hacen lo mismo por dentro: repetir un requestId nunca mueve el saldo dos veces.
   */
  findGiftCardResultByRequest(businessId: string, requestId: string): Promise<GiftCardResult | null>;
  /** Movimientos de una gift card del negocio, el más reciente primero. limit por defecto 100. */
  listGiftCardMovements(businessId: string, giftCardId: string, limit?: number): Promise<GiftCardMovement[]>;

  /** Avisos enviados a un cliente desde `sinceIso` (todas las plataformas), para el tope de 3 cada 24 h. */
  /** true si el cliente ya tiene un aviso registrado con ese `kind` (cualquier fecha). Evita repetir "Nuevo cupón". */
  hasWalletNotification(businessId: string, customerId: string, kind: string): Promise<boolean>;
  countWalletNotifications(businessId: string, customerId: string, sinceIso: string): Promise<number>;
  /** Registra un aviso enviado (uno por plataforma que lo aceptó). */
  logWalletNotification(n: NewWalletNotification): Promise<void>;
  /** Cupones enviados (sentAt) en el mes calendario actual de Ecuador. `now` por defecto, el reloj del repo. */
  countCampaignsThisMonth(businessId: string, now?: Date): Promise<number>;

  /* Servicio web de Apple Wallet (sin negocio: el serial identifica el pase) */
  /** Registra (o actualiza el push token de) un dispositivo para un pase. created = no existía ese registro. */
  appleRegister(reg: Omit<AppleRegistration, 'updatedAt'>): Promise<{ created: boolean }>;
  /** Borra el registro de ese dispositivo para ese pase (y el dispositivo si ya no tiene pases). */
  appleUnregister(deviceLibraryId: string, passTypeId: string, serial: string): Promise<void>;
  /**
   * Seriales registrados en el dispositivo cuyo pase cambió después de `updatedSinceIso` (todos si no viene), y la
   * fecha más reciente (lastUpdated, para el siguiente passesUpdatedSince). serials vacío = responder 204.
   */
  appleSerialsForDevice(deviceLibraryId: string, passTypeId: string, updatedSinceIso?: string): Promise<{ serials: string[]; lastUpdated: string | null }>;
  /** Push tokens de los dispositivos que tienen ese pase (para el push APNs vacío). */
  applePushTokensForSerial(passTypeId: string, serial: string): Promise<string[]>;
  /** Marca que el pase cambió (antes del push APNs), para que appleSerialsForDevice lo devuelva. Sin registros no hace nada. */
  appleMarkUpdated(passTypeId: string, serial: string): Promise<void>;
  /** APNs dijo que ese push token ya no sirve (410): borra los dispositivos con ese token y sus registros. */
  appleUnregisterToken(pushToken: string): Promise<void>;
}

const g = globalThis as unknown as { __stampaRepo?: Repo };

/** Singleton por proceso. STAMPA_REPO=supabase cambia a la implementación real. */
export function getRepo(): Repo {
  // En producción de Vercel el repo en memoria perdería datos reales entre instancias: mejor fallar a la vista.
  if (!g.__stampaRepo && process.env.VERCEL_ENV === 'production' && process.env.STAMPA_REPO !== 'supabase') {
    throw new Error('Producción sin base de datos: define STAMPA_REPO=supabase y SUPABASE_SERVICE_ROLE_KEY en Vercel.');
  }
  // En memoria (npm run dev) se cargan también los negocios de demostración del panel de administrador (seed-platform.ts).
  if (!g.__stampaRepo) g.__stampaRepo = process.env.STAMPA_REPO === 'supabase' ? createSupabaseRepo() : createMemoryRepo({ platformDemo: true });
  return g.__stampaRepo;
}
