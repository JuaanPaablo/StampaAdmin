/**
 * Id de operación para que el servidor no repita un cobro, recarga, venta o anulación (doble toque, reintento por red).
 * Se genera en el navegador al ARMAR la confirmación y viaja en un campo oculto `requestId`. Seguro en navegador y
 * servidor; sin crypto.randomUUID (navegadores viejos o http) usa getRandomValues.
 */
export function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
}
