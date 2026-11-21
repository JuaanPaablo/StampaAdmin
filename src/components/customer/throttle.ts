import { headers } from 'next/headers';
import { AttemptLimiter } from '@/lib/login-throttle';

/**
 * Límites por IP en memoria del proceso para la página pública del cliente (best-effort: con varias instancias cada una
 * cuenta aparte). Se suman a los del repo (5 códigos por correo por hora, 5 intentos por código).
 */

const WINDOW = 15 * 60_000;
const g = globalThis as unknown as { __stampaOtpIp?: AttemptLimiter; __stampaOtpVerifyIp?: AttemptLimiter; __stampaClaimIp?: AttemptLimiter };

/** Pedir códigos por correo: 10 por IP cada 15 min. Cada pedido cuenta. */
export const otpRequestLimiter = () => (g.__stampaOtpIp ??= new AttemptLimiter(10, WINDOW));
/** Códigos de correo equivocados: 20 por IP cada 15 min. */
export const otpVerifyLimiter = () => (g.__stampaOtpVerifyIp ??= new AttemptLimiter(20, WINDOW));
/** Códigos de sello rechazados: 15 por IP cada 15 min (evita probar números al azar). */
export const claimLimiter = () => (g.__stampaClaimIp ??= new AttemptLimiter(15, WINDOW));

export async function clientIp(): Promise<string> {
  const h = await Promise.resolve(headers());
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim().slice(0, 64) || 'unknown';
}
