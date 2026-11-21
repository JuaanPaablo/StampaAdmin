/** Tipos y reglas de las imágenes del negocio (logo y portada). Seguro para cliente y servidor. */

export type ImageKind = 'logo' | 'cover';
export interface ImageActionResult { ok: boolean; url?: string; error?: string }

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX = 2 * 1024 * 1024;

/** Validación previa en el navegador (el servidor vuelve a validar). */
export function checkImageFile(f: { type: string; size: number }): string | null {
  if (!TYPES.includes(f.type)) return 'La imagen debe ser PNG, JPG o WEBP.';
  if (f.size === 0) return 'Elige una imagen.';
  if (f.size > MAX) return 'La imagen pesa más de 2 MB. Usa una más liviana.';
  return null;
}

/** Sirve solo URLs que el repo pudo haber generado: https o data:image (repo en memoria). */
export function safeImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (/^https:\/\//i.test(url) || /^data:image\/(png|jpeg|webp);base64,/i.test(url)) return url;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\//i.test(url)) return url;
  return undefined;
}
