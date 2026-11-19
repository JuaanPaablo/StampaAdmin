/** Ruta interna a la que ir tras ingresar. Solo se aceptan rutas dentro de /panel (evita open redirect). */
export function safeNext(next: unknown, fallback = '/panel'): string {
  if (typeof next !== 'string') return fallback;
  const v = next.trim();
  if (v.length === 0 || v.length > 512) return fallback;
  if (!(v === '/panel' || v.startsWith('/panel/') || v.startsWith('/panel?') || v.startsWith('/panel#'))) return fallback;
  if (v.includes('..') || /[\\\u0000-\u001f\u007f]/.test(v)) return fallback;
  return v;
}
