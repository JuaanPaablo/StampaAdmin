/**
 * Configuración de Apple Wallet desde variables de entorno (Vercel, Sensitive). Sin TODAS las obligatorias, o con
 * alguna mal pegada, todo lo de Apple queda oculto (botón, servicio web, avisos). Nunca registra los valores.
 *
 *   APPLE_PASS_TYPE_ID          pass.app.stampa... (Pass Type ID del certificado)
 *   APPLE_TEAM_ID               10 letras/números (Team ID de la cuenta de desarrollador)
 *   APPLE_PASS_CERT_PEM_BASE64  certificado del Pass Type ID (PEM) en base64
 *   APPLE_PASS_KEY_PEM_BASE64   clave privada (PEM) en base64
 *   APPLE_PASS_KEY_PASSWORD     contraseña de la clave (opcional)
 *   APPLE_WWDR_PEM_BASE64       certificado intermedio WWDR de Apple (PEM) en base64
 *   APPLE_PASS_AUTH_SECRET      secreto para el token del servicio web (HMAC del serial), 32+ caracteres
 *
 * Se generan con OpenSSL en Git Bash: ver docs/WALLET.md → Apple.
 */

export interface AppleWalletConfig {
  passTypeId: string;
  teamId: string;
  certPem: string;
  keyPem: string;
  keyPassword?: string;
  wwdrPem: string;
  authSecret: string;
}

const pemFromBase64 = (b64: string, marker: RegExp): string | null => {
  if (!b64) return null;
  try {
    const pem = Buffer.from(b64, 'base64').toString('utf8').trim();
    return marker.test(pem) && /-----END [A-Z ]+-----/.test(pem) ? pem + '\n' : null;
  } catch {
    return null;
  }
};

let cached: { raw: string; config: AppleWalletConfig | null } | null = null;

export function appleWalletConfig(env: NodeJS.ProcessEnv = process.env): AppleWalletConfig | null {
  const v = (k: string) => env[k]?.trim() ?? '';
  const passTypeId = v('APPLE_PASS_TYPE_ID');
  const teamId = v('APPLE_TEAM_ID');
  const certB64 = v('APPLE_PASS_CERT_PEM_BASE64');
  const keyB64 = v('APPLE_PASS_KEY_PEM_BASE64');
  const wwdrB64 = v('APPLE_WWDR_PEM_BASE64');
  const authSecret = v('APPLE_PASS_AUTH_SECRET');
  const keyPassword = v('APPLE_PASS_KEY_PASSWORD') || undefined;
  const raw = [passTypeId, teamId, certB64, keyB64, wwdrB64, authSecret, keyPassword ?? ''].join('|');
  if (cached?.raw === raw) return cached.config;

  let config: AppleWalletConfig | null = null;
  const anySet = !!(passTypeId || teamId || certB64 || keyB64 || wwdrB64 || authSecret);
  if (anySet) {
    const certPem = pemFromBase64(certB64, /-----BEGIN CERTIFICATE-----/);
    const keyPem = pemFromBase64(keyB64, /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/);
    const wwdrPem = pemFromBase64(wwdrB64, /-----BEGIN CERTIFICATE-----/);
    const problems = [
      !/^pass\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(passTypeId) && 'APPLE_PASS_TYPE_ID',
      !/^[A-Z0-9]{10}$/.test(teamId) && 'APPLE_TEAM_ID',
      !certPem && 'APPLE_PASS_CERT_PEM_BASE64',
      !keyPem && 'APPLE_PASS_KEY_PEM_BASE64',
      !wwdrPem && 'APPLE_WWDR_PEM_BASE64',
      authSecret.length < 32 && 'APPLE_PASS_AUTH_SECRET'
    ].filter(Boolean);
    if (problems.length) console.error(`Apple Wallet desactivado: revisa ${problems.join(', ')}.`);   // solo nombres, nunca valores
    else config = { passTypeId, teamId, certPem: certPem!, keyPem: keyPem!, keyPassword, wwdrPem: wwdrPem!, authSecret };
  }
  cached = { raw, config };
  return config;
}
