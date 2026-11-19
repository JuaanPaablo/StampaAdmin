/**
 * Herramientas de demostración del panel: solo la sección "Probar en la demo" de cada código (simular escaneos de clientes).
 * NO afecta al acceso: iniciar sesión siempre requiere correo y contraseña.
 *
 * - Desarrollo (`npm run dev`): activo por defecto.
 * - Producción (`next start`): apagado por defecto. Actívalo con STAMPA_DEMO=on solo en despliegues de demostración.
 * - STAMPA_DEMO=off lo apaga en cualquier entorno.
 */
export function isDemoMode(): boolean {
  const v = process.env.STAMPA_DEMO;
  if (v === 'on') return true;
  if (v === 'off') return false;
  return process.env.NODE_ENV !== 'production';
}
