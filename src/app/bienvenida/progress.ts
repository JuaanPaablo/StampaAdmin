import { cookies } from 'next/headers';

/**
 * Hasta qué paso llegó el dueño en el asistente (0 a 4 pasos completos), en una cookie. Solo sirve para retomar donde
 * quedó al recargar: no da permisos. Los datos reales (nombre, sucursales) siguen mandando sobre este valor y
 * completeBusinessSetup() vuelve a validar todo.
 */
const NAME = 'stampa_bienvenida';
export const TOTAL_STEPS = 5;

export async function readProgress(businessId: string): Promise<number> {
  const jar = await Promise.resolve(cookies());
  const raw = jar.get(NAME)?.value ?? '';
  const [id, n] = raw.split(':');
  const v = Number(n);
  return id === businessId && Number.isInteger(v) && v >= 0 && v < TOTAL_STEPS ? v : 0;
}

/** Marca un paso como completo (nunca retrocede). Solo en server actions. */
export async function markStepDone(businessId: string, step: number): Promise<void> {
  const current = await readProgress(businessId);
  const next = Math.min(TOTAL_STEPS - 1, Math.max(current, step));
  const jar = await Promise.resolve(cookies());
  jar.set(NAME, `${businessId}:${next}`, {
    httpOnly: true, sameSite: 'lax', path: '/bienvenida', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearProgress(): Promise<void> {
  const jar = await Promise.resolve(cookies());
  jar.set(NAME, '', { httpOnly: true, sameSite: 'lax', path: '/bienvenida', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
}
