import { connect, constants, type ClientHttp2Session } from 'node:http2';
import type { AppleWalletConfig } from './config';

/**
 * Push APNs para pases de Wallet: HTTP/2 a api.push.apple.com con el MISMO certificado del Pass Type ID (TLS de
 * cliente), apns-topic = Pass Type ID y cuerpo `{}`. El iPhone solo entiende "algo cambió": luego pide al servicio
 * web la lista de pases cambiados y el pase nuevo. La sesión se reutiliza unos segundos entre envíos seguidos.
 */

const HOST = 'https://api.push.apple.com';
const IDLE_MS = 10_000;
const TIMEOUT_MS = 4_000;

type Creds = Pick<AppleWalletConfig, 'certPem' | 'keyPem' | 'keyPassword' | 'passTypeId'>;
let current: { session: ClientHttp2Session; key: string; idle?: ReturnType<typeof setTimeout> } | null = null;

function session(cfg: Creds): ClientHttp2Session {
  const key = cfg.passTypeId + '|' + cfg.certPem.length;
  if (current && current.key === key && !current.session.closed && !current.session.destroyed) {
    if (current.idle) clearTimeout(current.idle);
    return current.session;
  }
  current?.session.close();
  const s = connect(HOST, { cert: cfg.certPem, key: cfg.keyPem, passphrase: cfg.keyPassword });
  s.on('error', (e) => console.error('APNs:', e.message));
  s.on('close', () => { if (current?.session === s) current = null; });
  current = { session: s, key };
  return s;
}

function scheduleClose() {
  if (!current) return;
  const c = current;
  if (c.idle) clearTimeout(c.idle);
  c.idle = setTimeout(() => c.session.close(), IDLE_MS);
  c.idle.unref?.();
}

/** Un push. status HTTP de APNs (200 = aceptado, 410 = el token ya no existe) o 0 si no hubo respuesta. */
function pushOne(s: ClientHttp2Session, token: string, topic: string): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: { status: number; reason?: string }) => { if (!done) { done = true; resolve(r); } };
    try {
      const req = s.request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
        'apns-topic': topic,                          // sin apns-push-type: así lo usan las librerías de pases probadas
        'content-type': 'application/json'
      });
      let status = 0;
      let body = '';
      req.setTimeout(TIMEOUT_MS, () => { req.close(constants.NGHTTP2_CANCEL); finish({ status: 0, reason: 'timeout' }); });
      req.on('response', (h) => { status = Number(h[constants.HTTP2_HEADER_STATUS]) || 0; });
      req.setEncoding('utf8');
      req.on('data', (c: string) => { body += c; });
      req.on('end', () => {
        let reason: string | undefined;
        try { reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined; } catch { /* sin cuerpo JSON */ }
        finish({ status, reason });
      });
      req.on('error', (e) => finish({ status: 0, reason: e.message }));
      req.end('{}');
    } catch (e) {
      finish({ status: 0, reason: e instanceof Error ? e.message : String(e) });
    }
  });
}

/** Tokens que APNs dice que ya no sirven (hay que borrar su registro). */
export const isGoneToken = (r: { status: number; reason?: string }) =>
  r.status === 410 || (r.status === 400 && (r.reason === 'BadDeviceToken' || r.reason === 'DeviceTokenNotForTopic'));

/**
 * Envía el push vacío a cada token. Devuelve cuántos aceptó APNs y los tokens vencidos. Nunca lanza.
 * Los tokens con formato raro (no hexadecimales) se ignoran.
 */
export async function pushPassUpdate(tokens: string[], cfg: Creds): Promise<{ sent: number; gone: string[] }> {
  const list = [...new Set(tokens.filter((t) => /^[0-9a-fA-F]{32,200}$/.test(t)))];
  if (!list.length) return { sent: 0, gone: [] };
  try {
    const s = session(cfg);
    const results = await Promise.all(list.map((t) => pushOne(s, t, cfg.passTypeId).then((r) => ({ t, r }))));
    scheduleClose();
    const gone = results.filter(({ r }) => isGoneToken(r)).map(({ t }) => t);
    const failed = results.filter(({ r }) => r.status !== 200 && !isGoneToken(r));
    if (failed.length) console.error(`APNs: ${failed.length} push sin aceptar (${[...new Set(failed.map(({ r }) => `${r.status} ${r.reason ?? ''}`.trim()))].join(', ')}).`);
    return { sent: results.filter(({ r }) => r.status === 200).length, gone };
  } catch (e) {
    console.error('APNs:', e instanceof Error ? e.message : e);
    return { sent: 0, gone: [] };
  }
}
