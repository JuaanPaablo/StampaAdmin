import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Enlaces de un solo uso y códigos de verificación (solo servidor). En la base se guarda el hash, nunca el valor. */

/** 32 bytes aleatorios en base64url (43 caracteres). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 en hex. Suficiente para tokens de alta entropía; para códigos de 6 dígitos se combina con el correo. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Código numérico de 6 dígitos (000000..999999) con generador criptográfico. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Hash de un código de verificación ligado a su correo, para que el mismo código no sirva con otro correo. */
export function hashOtp(email: string, code: string): string {
  return hashToken(`${email.trim().toLowerCase()}:${code.trim()}`);
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Forma válida de un token emitido por generateToken (evita consultas con basura). */
export function isTokenShape(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}
