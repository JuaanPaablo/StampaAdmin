import { createSign } from 'node:crypto';
import type { CustomerCard } from '../contracts';
import { appUrl, customerUrl } from '../urls';
import { buildPassModel, googleLoyaltyObject, type PassModel } from './pass-model';

/**
 * Google Wallet (Android). Sin dependencias: el JWT se firma con node:crypto (RS256) y la API se llama con fetch.
 *
 * - Guardar: enlace https://pay.google.com/gp/v/save/<jwt> con la clase del negocio y el objeto del cliente adentro
 *   ("fat JWT"). Google los crea la primera vez; si ya existen, no los toca (por eso antes se actualiza con PATCH).
 * - Actualizar: PATCH al loyaltyObject cada vez que cambian los sellos (syncGoogleWallet).
 *
 * Variables (Vercel, Sensitive): GOOGLE_WALLET_ISSUER_ID y GOOGLE_WALLET_SA_JSON_BASE64 (clave JSON de la cuenta de
 * servicio en base64). Sin ellas el botón no aparece y la sincronización no hace nada. Ver docs/WALLET.md.
 */

interface ServiceAccount { client_email: string; private_key: string }
export interface GoogleWalletConfig { issuerId: string; sa: ServiceAccount }

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

/* ---------- JWT (RS256) ---------- */

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

export function signJwt(payload: Record<string, unknown>, privateKeyPem: string): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(payload));
  const sig = createSign('RSA-SHA256').update(head).sign(privateKeyPem);
  return head + '.' + b64url(sig);
}

/* ---------- Ids y recursos ---------- */

/** Google solo admite letras, números, '.', '_' y '-' después del issuer. */
const safeId = (s: string) => s.replace(/[^\w.-]/g, '_');
export const classSuffix = (businessId: string) => `stampa_${safeId(businessId)}`;

/**
 * Logo de la clase: Google lo descarga, así que debe ser una URL https pública. El respaldo sale siempre del dominio de
 * producción: las versiones de prueba de Vercel piden inicio de sesión y Google no podría bajarlo.
 */
const FALLBACK_LOGO = 'https://stampaecu.app/apple-touch-icon.png';
function logoUri(card: CustomerCard): string {
  const url = card.program.logoUrl;
  return url && /^https:\/\//.test(url) ? url : FALLBACK_LOGO;
}

export function googleLoyaltyClass(card: CustomerCard, m: PassModel, issuerId: string) {
  return {
    id: `${issuerId}.${classSuffix(card.business.id)}`,
    issuerName: m.businessName.slice(0, 20) || 'Stampa',
    programName: m.programName,
    programLogo: { sourceUri: { uri: logoUri(card) }, contentDescription: { defaultValue: { language: 'es', value: m.businessName } } },
    hexBackgroundColor: m.colors.bg,
    countryCode: 'EC',
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES'
  };
}

export function passModelFor(card: CustomerCard, now: Date = new Date()): PassModel {
  return buildPassModel(card.business, card.program, card.customer, customerUrl(card.business.slug), [], now);
}

export function loyaltyObjectFor(card: CustomerCard, issuerId: string, now: Date = new Date()) {
  const m = passModelFor(card, now);
  const obj = googleLoyaltyObject({ ...m, serial: safeId(m.serial) }, issuerId, classSuffix(card.business.id));
  return { model: m, obj };
}

/** Enlace "Guardar en Google Wallet". */
export function googleSaveUrl(card: CustomerCard, config: GoogleWalletConfig, now: Date = new Date()): string {
  const { model, obj } = loyaltyObjectFor(card, config.issuerId, now);
  const jwt = signJwt({
    iss: config.sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(now.getTime() / 1000),
    origins: [appUrl()],
    payload: { loyaltyClasses: [googleLoyaltyClass(card, model, config.issuerId)], loyaltyObjects: [obj] }
  }, config.sa.private_key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/* ---------- API (actualizar el pase) ---------- */

let token: { value: string; exp: number; email: string } | null = null;

async function accessToken(config: GoogleWalletConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (token && token.email === config.sa.client_email && token.exp - 60 > now) return token.value;
  const assertion = signJwt({ iss: config.sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }, config.sa.private_key);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(4000)
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: now + j.expires_in, email: config.sa.client_email };
  return token.value;
}

/**
 * Actualiza el pase del cliente si ya lo guardó (si no existe, Google responde 404 y no se hace nada).
 * Nunca lanza: un fallo de Google no debe impedir sumar un sello.
 */
export async function syncGoogleWallet(card: CustomerCard | null): Promise<void> {
  const config = googleWalletConfig();
  if (!config || !card) return;
  try {
    const { obj } = loyaltyObjectFor(card, config.issuerId);
    const res = await fetch(`${API}/loyaltyObject/${encodeURIComponent(obj.id)}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${await accessToken(config)}`, 'content-type': 'application/json' },
      body: JSON.stringify(obj),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok && res.status !== 404) console.error('Google Wallet PATCH:', res.status, (await res.text()).slice(0, 300));
  } catch (e) {
    console.error('Google Wallet:', e instanceof Error ? e.message : e);
  }
}
