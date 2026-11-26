import { getRepo } from '../../repo';
import { checkAppleAuth, parseAppleSerial } from './auth';
import { appleWalletConfig, type AppleWalletConfig } from './config';
import { buildApplePass, pkpassResponse, resolveAppleSerial } from './service';

/**
 * Servicio web de Apple Wallet (https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes).
 * Las rutas de src/app/api/wallet/v1/** solo llaman a estas funciones (así se prueban sin Next).
 *
 * Sin configuración de Apple todo responde 404 (queda oculto). Pass Type ID distinto al nuestro → 404.
 * Token inválido → 401. Nunca se registran tokens ni datos del cliente.
 */

const DEVICE = /^[A-Za-z0-9_-]{1,200}$/;
/** Token de APNs: 32 bytes en hexadecimal. */
const PUSH_TOKEN = /^[0-9a-f]{64}$/i;
const empty = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers: { 'cache-control': 'no-store', ...headers } });

function guard(passType: string, serial?: string): { cfg: AppleWalletConfig } | Response {
  const cfg = appleWalletConfig();
  if (!cfg || passType !== cfg.passTypeId) return empty(404);
  if (serial !== undefined && !parseAppleSerial(serial)) return empty(404);
  return { cfg };
}

/** POST /v1/devices/:device/registrations/:passType/:serial  → 201 nuevo · 200 ya existía. */
export async function registerDevice(req: Request, device: string, passType: string, serial: string): Promise<Response> {
  const g = guard(passType, serial);
  if (g instanceof Response) return g;
  if (!checkAppleAuth(req.headers.get('authorization'), serial, g.cfg.authSecret)) return empty(401);
  if (!DEVICE.test(device)) return empty(400);
  let pushToken = '';
  try { pushToken = String(((await req.json()) as { pushToken?: unknown })?.pushToken ?? ''); } catch { /* cuerpo inválido */ }
  if (!PUSH_TOKEN.test(pushToken)) return empty(400);
  try {
    const { created } = await getRepo().appleRegister({ deviceLibraryId: device, pushToken, passTypeId: passType, serial });
    return empty(created ? 201 : 200);
  } catch (e) {
    console.error('Apple Wallet registro:', e instanceof Error ? e.message : e);
    return empty(500);
  }
}

/** DELETE /v1/devices/:device/registrations/:passType/:serial → 200. */
export async function unregisterDevice(req: Request, device: string, passType: string, serial: string): Promise<Response> {
  const g = guard(passType, serial);
  if (g instanceof Response) return g;
  if (!checkAppleAuth(req.headers.get('authorization'), serial, g.cfg.authSecret)) return empty(401);
  if (!DEVICE.test(device)) return empty(400);
  try {
    await getRepo().appleUnregister(device, passType, serial);
    return empty(200);
  } catch (e) {
    console.error('Apple Wallet baja:', e instanceof Error ? e.message : e);
    return empty(500);
  }
}

/** GET /v1/devices/:device/registrations/:passType?passesUpdatedSince=tag → 200 JSON · 204 sin cambios. */
export async function serialsForDevice(req: Request, device: string, passType: string): Promise<Response> {
  const g = guard(passType);
  if (g instanceof Response) return g;
  if (!DEVICE.test(device)) return empty(400);
  const tag = new URL(req.url).searchParams.get('passesUpdatedSince') ?? '';
  const since = tag && Number.isFinite(Date.parse(tag)) ? new Date(Date.parse(tag)).toISOString() : undefined;
  try {
    const { serials, lastUpdated } = await getRepo().appleSerialsForDevice(device, passType, since);
    if (!serials.length) return empty(204);
    return Response.json({ serialNumbers: serials, lastUpdated: lastUpdated ?? new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('Apple Wallet lista:', e instanceof Error ? e.message : e);
    return empty(500);
  }
}

/** GET /v1/passes/:passType/:serial → 200 .pkpass · 304 sin cambios (If-Modified-Since) · 404 ya no existe. */
export async function latestPass(req: Request, passType: string, serial: string, now: Date = new Date()): Promise<Response> {
  const g = guard(passType, serial);
  if (g instanceof Response) return g;
  if (!checkAppleAuth(req.headers.get('authorization'), serial, g.cfg.authSecret)) return empty(401);
  try {
    const src = await resolveAppleSerial(serial);
    if (!src) return empty(404);
    const pass = buildApplePass(src, g.cfg, now);
    const since = Date.parse(req.headers.get('if-modified-since') ?? '');
    // Last-Modified sale del contenido (service.ts): solo la MISMA fecha significa el mismo pase.
    if (Number.isFinite(since) && since === pass.lastModified.getTime()) return empty(304, { 'last-modified': pass.lastModified.toUTCString() });
    return pkpassResponse(pass);
  } catch (e) {
    console.error('Apple Wallet pase:', e instanceof Error ? e.message : e);
    return empty(500);
  }
}

/** Quita caracteres de control (evita inyectar líneas falsas en los registros) y recorta. */
export const cleanLogLine = (s: string, max = 300): string =>
  Array.from(s, (ch) => { const c = ch.charCodeAt(0); return c < 32 || (c >= 127 && c <= 159) || c === 0x2028 || c === 0x2029 ? ' ' : ch; })
    .join('').replace(/ {2,}/g, ' ').trim().slice(0, max);

/**
 * POST /v1/log → 200. Errores que reporta el iPhone (útil al probar). Cualquiera puede llamar a esta ruta, así que
 * solo se escriben en los registros con APPLE_WALLET_DEBUG=on, limpios y recortados.
 */
export async function deviceLog(req: Request, env: NodeJS.ProcessEnv = process.env): Promise<Response> {
  if (!appleWalletConfig()) return empty(404);
  if (env.APPLE_WALLET_DEBUG !== 'on') return empty(200);
  try {
    const text = (await req.text()).slice(0, 8_000);
    const logs = (JSON.parse(text) as { logs?: unknown }).logs;
    if (Array.isArray(logs)) for (const l of logs.slice(0, 10)) console.warn('Apple Wallet (iPhone):', cleanLogLine(String(l)));
  } catch { /* cuerpo inválido: igual 200 */ }
  return empty(200);
}
