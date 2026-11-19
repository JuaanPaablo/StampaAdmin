import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Contraseñas de acceso al panel (solo servidor).
 * Formato almacenado: `scrypt$N$r$p$salt$hash` (salt y hash en base64). Nunca se guarda texto plano.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

const KEYLEN = 32;
const DEFAULTS = { N: 16384, r: 8, p: 1 } as const;
const MAX_N = 1 << 20; // tope defensivo al leer un hash almacenado

export interface ScryptParams { N: number; r: number; p: number }

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const opts: ScryptOptions = { N: params.N, r: params.r, p: params.p, maxmem: 256 * params.N * params.r };
  return new Promise((resolve, reject) => scrypt(password.normalize('NFKC'), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

const format = (params: ScryptParams, salt: Buffer, hash: Buffer) =>
  ['scrypt', params.N, params.r, params.p, salt.toString('base64'), hash.toString('base64')].join('$');

/** Política al crear cuentas. Devuelve el mensaje de error o null si es válida. */
export function validatePassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `La contraseña no puede pasar de ${MAX_PASSWORD_LENGTH} caracteres.`;
  return null;
}

export async function hashPassword(password: string, params: ScryptParams = DEFAULTS): Promise<string> {
  const salt = randomBytes(16);
  return format(params, salt, await derive(password, salt, params));
}

/** Versión síncrona, solo para arrancar los datos de ejemplo en memoria. */
export function hashPasswordSync(password: string, params: ScryptParams = DEFAULTS): string {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N: params.N, r: params.r, p: params.p, maxmem: 256 * params.N * params.r });
  return format(params, salt, key);
}

function parse(stored: string | null | undefined): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  if (!stored) return null;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0) || N > MAX_N || (N & (N - 1)) !== 0 || r > 32 || p > 16) return null;
  const salt = Buffer.from(parts[4], 'base64');
  const hash = Buffer.from(parts[5], 'base64');
  if (salt.length < 8 || hash.length !== KEYLEN) return null;
  return { params: { N, r, p }, salt, hash };
}

let dummy: string | undefined;
/** Hash válido de un valor aleatorio: sirve para gastar el mismo tiempo cuando la cuenta no existe. */
export function dummyHash(): string {
  return (dummy ??= hashPasswordSync(randomBytes(12).toString('base64')));
}

/** Comparación en tiempo constante. Con un hash ausente o mal formado compara contra uno falso y devuelve false. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parsed = parse(stored);
  const target = parsed ?? parse(dummyHash())!;
  const key = await derive(typeof password === 'string' ? password : '', target.salt, target.params);
  const ok = key.length === target.hash.length && timingSafeEqual(key, target.hash);
  return parsed !== null && ok;
}
