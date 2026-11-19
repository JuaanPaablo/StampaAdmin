/**
 * Modo demostración: conmutador de negocio/persona sin PIN, credenciales de prueba en /ingresar, panel
 * "Probar en la demo" en Caja y acceso sin sesión al negocio demo.
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
