/** Sin imports de servidor: lo usa PasswordInput en el navegador. Probado en helpers.test.ts. */

/* ---------- Ayuda en vivo de las contraseñas ---------- */

export interface PasswordHint { ok: boolean; text: string; extra?: string }

/**
 * Lo que se muestra bajo un campo de contraseña mientras se escribe. Con `matchValue` es el campo "Repite la contraseña".
 * `extra` (el contador) es solo visual: no se anuncia en cada tecla con el lector de pantalla.
 */
export function passwordHint(value: string, minLength?: number, matchValue?: string): PasswordHint | null {
  if (matchValue !== undefined) {
    if (!value) return null;
    return value === matchValue ? { ok: true, text: 'Coinciden' } : { ok: false, text: 'Aún no coinciden' };
  }
  if (minLength) {
    if (value.length >= minLength) return { ok: true, text: `${minLength} caracteres o más` };
    return { ok: false, text: `Mínimo ${minLength} caracteres`, extra: value ? ` · faltan ${minLength - value.length}` : undefined };
  }
  return null;
}
