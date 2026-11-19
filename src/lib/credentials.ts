/** Normalización y validación del correo de acceso. */
export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function validateEmail(email: string): string | null {
  const e = normalizeEmail(email);
  if (e.length < 5 || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Escribe un correo válido.';
  return null;
}
