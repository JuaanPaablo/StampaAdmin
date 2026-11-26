import { createSign, randomBytes } from 'node:crypto';
import type { Business, CustomerCard, Location, Program } from '../contracts';
import { appUrl, customerPath, customerUrl } from '../urls';
import { buildPassModel, googleLoyaltyObject, type PassModel } from './pass-model';
import { googleOfferObject, offerClassFor } from './google-offer';
import { googleGiftCardObject } from './google-giftcard';

/**
 * Google Wallet (Android). Sin dependencias: el JWT se firma con node:crypto (RS256) y la API se llama con fetch.
 *
 * - Guardar: enlace https://pay.google.com/gp/v/save/<jwt> con la clase del negocio y el objeto del cliente adentro
 *   ("fat JWT"). Google los crea la primera vez; si ya existen, no los toca (por eso antes se actualiza con PATCH).
 * - Actualizar: PATCH al loyaltyObject cada vez que cambian los sellos (syncGoogleWallet). La misma llamada actualiza
 *   los cupones (offerObject, google-offer.ts) y gift cards (giftCardObject, google-giftcard.ts) del cliente.
 * - Cupones enlazados: si el cliente guardó su tarjeta de sellos (customer.wallet === 'google'), sus cupones vigentes se
 *   crean por API y se enlazan a la tarjeta con `linkedOfferIds`, así aparecen sin tocar otro botón.
 *
 * Variables (Vercel, Sensitive): GOOGLE_WALLET_ISSUER_ID y GOOGLE_WALLET_SA_JSON_BASE64 (clave JSON de la cuenta de
 * servicio en base64). Sin ellas el botón no aparece y la sincronización no hace nada. Ver docs/WALLET.md.
 */

interface ServiceAccount { client_email: string; private_key: string }
export interface GoogleWalletConfig { issuerId: string; sa: ServiceAccount }

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Igual que el resto de llamadas a Google: nunca esperar más de 4 s. */
const TIMEOUT_MS = 4000;
/** Llamadas a Google a la vez dentro de una misma sincronización (cupones y gift cards de un cliente). */
const CONCURRENCY = 4;

let cachedConfig: { raw: string; config: GoogleWalletConfig | null } | null = null;

export function googleWalletConfig(env: NodeJS.ProcessEnv = process.env): GoogleWalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim() ?? '';
  const b64 = env.GOOGLE_WALLET_SA_JSON_BASE64?.trim() ?? '';
  const raw = issuerId + '|' + b64;
  if (cachedConfig?.raw === raw) return cachedConfig.config;
  let config: GoogleWalletConfig | null = null;
  if (/^\d{10,25}$/.test(issuerId) && b64) {
    try {
      const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Partial<ServiceAccount>;
      if (typeof sa.client_email === 'string' && typeof sa.private_key === 'string' && sa.private_key.includes('PRIVATE KEY')) {
        config = { issuerId, sa: { client_email: sa.client_email, private_key: sa.private_key } };
      }
    } catch { /* clave mal pegada: queda desactivado */ }
    if (!config) console.error('Google Wallet: GOOGLE_WALLET_SA_JSON_BASE64 no es una clave JSON válida en base64.');
  }
  cachedConfig = { raw, config };
  return config;
}

export const googleWalletEnabled = () => googleWalletConfig() !== null;

/**
 * El botón "Agregar a Google Wallet" se ve siempre en Preview, pero en Production solo con GOOGLE_WALLET_PUBLIC=on
 * (cuando Google apruebe el acceso de publicación; antes, a los clientes reales les daría "solo para pruebas").
 * La actualización de pases ya guardados funciona en ambos con solo tener la clave.
 */
export function googleWalletButtonVisible(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!googleWalletConfig(env)) return false;
  return env.VERCEL_ENV !== 'production' || env.GOOGLE_WALLET_PUBLIC?.trim() === 'on';
}

/** Botones "Agregar a Google Wallet" de cupones y gift cards: misma regla que el de sellos. */
export const googleOfferSaveVisible = (env: NodeJS.ProcessEnv = process.env) => googleWalletButtonVisible(env);

/** Rutas de guardado para la página del cliente (con sesión; solo su propio cupón o gift card). */
export const googleCouponSavePath = (slug: string, customerOfferId: string) =>
  `${customerPath(slug)}/wallet/google/cupon/${encodeURIComponent(customerOfferId)}`;
export const googleGiftSavePath = (slug: string, giftCardId: string) =>
  `${customerPath(slug)}/wallet/google/gift/${encodeURIComponent(giftCardId)}`;

/* ---------- JWT (RS256) ---------- */

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

export function signJwt(payload: Record<string, unknown>, privateKeyPem: string): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(payload));
  const sig = createSign('RSA-SHA256').update(head).sign(privateKeyPem);
  return head + '.' + b64url(sig);
}

/** Enlace "Guardar en Google Wallet" con las clases y objetos dados (loyaltyClasses, offerObjects, ...). */
export function googleSaveJwtUrl(config: GoogleWalletConfig, payload: Record<string, unknown[]>, now: Date = new Date()): string {
  const jwt = signJwt({
    iss: config.sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(now.getTime() / 1000),
    origins: [appUrl()],
    payload
  }, config.sa.private_key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/* ---------- Ids, marca y recursos ---------- */

/** Google solo admite letras, números, '.', '_' y '-' después del issuer. */
export function safeId(s: string): string {
  return s.replace(/[^\w.-]/g, '_');
}
export const classSuffix = (businessId: string) => `stampa_${safeId(businessId)}`;

/**
 * Logo de la clase: Google lo descarga, así que debe ser una URL https pública. El respaldo sale siempre del dominio de
 * producción: las versiones de prueba de Vercel piden inicio de sesión y Google no podría bajarlo.
 */
const FALLBACK_LOGO = 'https://stampaecu.app/wallet/logo-660.png';
function logoUri(program: Pick<Program, 'logoUrl'>): string {
  const url = program.logoUrl;
  return url && /^https:\/\//.test(url) ? url : FALLBACK_LOGO;
}

/** Lo común a las clases de un negocio (sellos, cupones y gift cards): nombre, logo, colores y sucursales. */
export interface GoogleBrand {
  businessId: string;
  businessName: string;
  /** Máx. 20 letras (límite de issuerName en Google). */
  issuerName: string;
  logo: { sourceUri: { uri: string }; contentDescription: { defaultValue: { language: 'es'; value: string } } };
  bg: string;
  cardUrl: string;
  merchantLocations: { latitude: number; longitude: number }[];
}

export function googleBrand(
  business: Pick<Business, 'id' | 'name' | 'slug'>,
  program: Pick<Program, 'name' | 'stampsRequired' | 'rewardTitle' | 'colors' | 'logoText' | 'logoUrl' | 'milestones' | 'terms'>,
  locations: (Pick<Location, 'name'> & { latitude?: number; longitude?: number })[] = []
): GoogleBrand {
  const m = buildPassModel(business, program, { id: '', name: '', stamps: 0 }, customerUrl(business.slug), locations);
  return {
    businessId: business.id,
    businessName: business.name,
    issuerName: business.name.slice(0, 20) || 'Stampa',
    logo: { sourceUri: { uri: logoUri(program) }, contentDescription: { defaultValue: { language: 'es', value: business.name } } },
    bg: m.colors.bg,
    cardUrl: m.cardUrl,
    merchantLocations: m.locations.map((l) => ({ latitude: l.latitude, longitude: l.longitude }))
  };
}

export const brandFromCard = (card: CustomerCard): GoogleBrand => googleBrand(card.business, card.program, card.locations ?? []);

export function googleLoyaltyClass(card: CustomerCard, m: PassModel, issuerId: string) {
  return {
    id: `${issuerId}.${classSuffix(card.business.id)}`,
    issuerName: m.businessName.slice(0, 20) || 'Stampa',
    programName: m.programName,
    programLogo: { sourceUri: { uri: logoUri(card.program) }, contentDescription: { defaultValue: { language: 'es', value: m.businessName } } },
    hexBackgroundColor: m.colors.bg,
    countryCode: 'EC',
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES'
  };
}

/** Modelo del pase con las sucursales con coordenadas (card.locations: activas, máx. 10) para merchantLocations. */
export function passModelFor(card: CustomerCard, now: Date = new Date()): PassModel {
  return buildPassModel(card.business, card.program, card.customer, customerUrl(card.business.slug), card.locations ?? [], now);
}

export function loyaltyObjectFor(card: CustomerCard, issuerId: string, now: Date = new Date()) {
  const m = passModelFor(card, now);
  const obj = googleLoyaltyObject({ ...m, serial: safeId(m.serial) }, issuerId, classSuffix(card.business.id));
  return { model: m, obj };
}

/** Enlace "Guardar en Google Wallet" (tarjeta de sellos). */
export function googleSaveUrl(card: CustomerCard, config: GoogleWalletConfig, now: Date = new Date()): string {
  const { model, obj } = loyaltyObjectFor(card, config.issuerId, now);
  return googleSaveJwtUrl(config, { loyaltyClasses: [googleLoyaltyClass(card, model, config.issuerId)], loyaltyObjects: [obj] }, now);
}

/* ---------- API ---------- */

let token: { value: string; exp: number; email: string } | null = null;

async function accessToken(config: GoogleWalletConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (token && token.email === config.sa.client_email && token.exp - 60 > now) return token.value;
  const assertion = signJwt({ iss: config.sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }, config.sa.private_key);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: now + j.expires_in, email: config.sa.client_email };
  return token.value;
}

/** Solo para pruebas: olvida el token y las clases ya aseguradas. */
export function resetGoogleWalletCacheForTests(): void {
  token = null;
  cachedConfig = null;
  ensuredClasses.clear();
}

export interface WalletResponse { ok: boolean; status: number; text: string }

/**
 * Llamada a la API de Wallet. Nunca lanza: un fallo de red o del token se devuelve como status 0.
 * `path` sin barra inicial, por ejemplo `loyaltyObject/<id>` o `offerObject`.
 */
export async function walletRequest(config: GoogleWalletConfig, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<WalletResponse> {
  try {
    const res = await fetch(`${API}/${path}`, {
      method,
      headers: { authorization: `Bearer ${await accessToken(config)}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return { ok: res.ok, status: res.status, text: res.ok ? '' : (await res.text()).slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
  }
}

export type GoogleResource = 'loyaltyObject' | 'offerClass' | 'offerObject' | 'giftCardClass' | 'giftCardObject';

/**
 * PATCH del recurso; si no existe (404) y `insert`, lo crea con POST (409 = otro lo creó a la vez: ok).
 * 'missing' = no existe y no se creó (el cliente no lo guardó). Nunca lanza.
 */
export async function upsertResource(config: GoogleWalletConfig, type: GoogleResource, obj: { id: string }, opts: { insert?: boolean } = {}): Promise<'ok' | 'missing' | 'error'> {
  const r = await walletRequest(config, 'PATCH', `${type}/${encodeURIComponent(obj.id)}`, obj);
  if (r.ok) return 'ok';
  if (r.status === 404) {
    if (!opts.insert) return 'missing';
    const ins = await walletRequest(config, 'POST', type, obj);
    if (ins.ok || ins.status === 409) return 'ok';
    console.error(`Google Wallet POST ${type}:`, ins.status, ins.text);
    return 'error';
  }
  console.error(`Google Wallet PATCH ${type}:`, r.status, r.text);
  return 'error';
}

/** Clases ya creadas/actualizadas en este proceso (una promesa por id: evita crear la misma clase 5 veces a la vez). */
const ensuredClasses = new Map<string, { at: number; p: Promise<boolean> }>();
const CLASS_TTL_MS = 10 * 60 * 1000;

/** Crea o actualiza una clase una sola vez cada 10 min por proceso. true si existe. */
export function ensureClass(config: GoogleWalletConfig, type: 'offerClass' | 'giftCardClass', cls: { id: string }): Promise<boolean> {
  const hit = ensuredClasses.get(cls.id);
  if (hit && Date.now() - hit.at < CLASS_TTL_MS) return hit.p;
  const p = upsertResource(config, type, cls, { insert: true }).then((r) => {
    if (r !== 'ok') ensuredClasses.delete(cls.id);
    return r === 'ok';
  });
  ensuredClasses.set(cls.id, { at: Date.now(), p });
  return p;
}

/** Ejecuta fn sobre items con como mucho `limit` a la vez. Conserva el orden de los resultados. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Actualiza los pases de Google del cliente: tarjeta de sellos, cupones vigentes y gift cards activas. Solo PATCH a lo
 * que el cliente guardó (404 = no lo guardó, se ignora). Excepción: si guardó la tarjeta de sellos
 * (customer.wallet === 'google'), sus cupones vigentes se crean (POST) y se enlazan con `linkedOfferIds` (la lista se
 * reemplaza: los cupones usados o vencidos se desenlazan solos).
 * Nunca lanza: un fallo de Google no debe impedir sumar un sello.
 */
export async function syncGoogleWallet(card: CustomerCard | null): Promise<void> {
  const config = googleWalletConfig();
  if (!config || !card) return;
  try {
    const hasGoogleCard = card.customer.wallet === 'google';
    // Cupones y gift cards se actualizan SIEMPRE (PATCH; 404 = no lo guardó). customer.wallet no sirve para
    // saltárselos: un cliente puede tener pases en las dos plataformas y el campo lo cambia una descarga (GET).
    const brand = brandFromCard(card);
    const offers = card.offers ?? [];
    const gifts = card.giftCards ?? [];

    // 1) Cupones: asegurar la clase y el objeto (crear solo si tiene la tarjeta de sellos guardada).
    const linked = await mapLimit(offers, CONCURRENCY, async (co) => {
      if (hasGoogleCard && !(await ensureClass(config, 'offerClass', offerClassFor(brand, co.offer, config.issuerId)))) return null;
      const obj = googleOfferObject(brand, co, config.issuerId);
      const r = await upsertResource(config, 'offerObject', obj, { insert: hasGoogleCard });
      return r === 'ok' ? obj.id : null;
    });

    // 2) Tarjeta de sellos (con los cupones enlazados).
    const { obj } = loyaltyObjectFor(card, config.issuerId);
    const body = hasGoogleCard ? { ...obj, linkedOfferIds: linked.filter((id): id is string => !!id) } : obj;
    const r = await walletRequest(config, 'PATCH', `loyaltyObject/${encodeURIComponent(obj.id)}`, body);
    if (!r.ok && r.status !== 404) console.error('Google Wallet PATCH:', r.status, r.text);

    // 3) Gift cards: solo las que guardó con su botón.
    await mapLimit(gifts, CONCURRENCY, (g) => upsertResource(config, 'giftCardObject', googleGiftCardObject(brand, g, config.issuerId)));
  } catch (e) {
    console.error('Google Wallet:', e instanceof Error ? e.message : e);
  }
}

/* ---------- Avisos ---------- */

const isQuotaError = (r: WalletResponse) => r.status === 429 || /quota/i.test(r.text);

/** Id único de mensaje (Google permite repetidos, pero así cada aviso es distinguible). */
export const googleMessageId = (now: number = Date.now()) => `stampa_${now.toString(36)}_${randomBytes(4).toString('hex')}`;

/**
 * Aviso con notificación en el pase de sellos del cliente (addMessage con TEXT_AND_NOTIFY; si Google responde
 * QuotaExceededException o 429, se manda como TEXT sin aviso y devuelve false). true solo si Google lo aceptó con
 * aviso. 404 (no guardó la tarjeta) → false. Nunca lanza.
 */
export async function notifyGoogle(card: CustomerCard, message: string): Promise<boolean> {
  const config = googleWalletConfig();
  const text = message.trim();
  if (!config || !card || !text) return false;
  try {
    const { obj } = loyaltyObjectFor(card, config.issuerId);
    const path = `loyaltyObject/${encodeURIComponent(obj.id)}/addMessage`;
    const msg = (messageType: 'TEXT_AND_NOTIFY' | 'TEXT') => ({
      message: { id: googleMessageId(), header: card.business.name.slice(0, 60) || 'Stampa', body: text.slice(0, 500), messageType }
    });
    const r = await walletRequest(config, 'POST', path, msg('TEXT_AND_NOTIFY'));
    if (r.ok) return true;
    if (r.status === 404) return false;
    if (isQuotaError(r)) {
      const t = await walletRequest(config, 'POST', path, msg('TEXT'));
      if (!t.ok && t.status !== 404) console.error('Google Wallet addMessage TEXT:', t.status, t.text);
      return false;
    }
    console.error('Google Wallet addMessage:', r.status, r.text);
    return false;
  } catch (e) {
    console.error('Google Wallet addMessage:', e instanceof Error ? e.message : e);
    return false;
  }
}
