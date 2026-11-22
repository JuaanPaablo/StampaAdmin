import type { BusinessType } from '../contracts';

/**
 * Fotos de Marketing: el dueño sube una foto REAL (su plato, su local, su producto) y la IA solo la mejora.
 * Nunca se inventa el producto desde cero: sería publicidad engañosa (el cliente llega y el plato no se parece).
 *
 * Cada estilo es una instrucción fija para el editor de imágenes (Seedream vía fal.ai). Van en inglés porque el
 * modelo las sigue con más precisión; todas exigen conservar el producto idéntico y no agregar texto.
 */

export type PhotoStyle = 'profesional' | 'ambiente' | 'estudio' | 'temporada';
export type Season = 'navidad' | 'fin_de_ano' | 'san_valentin' | 'dia_madre' | 'dia_padre' | 'halloween' | 'verano';

export interface StyleInfo { id: PhotoStyle; label: string; hint: string }

export const PHOTO_STYLES: StyleInfo[] = [
  { id: 'profesional', label: 'Retoque profesional', hint: 'Mejor luz, color y nitidez. Tu foto, pero de revista.' },
  { id: 'ambiente', label: 'Con ambiente', hint: 'Lo pone en un entorno acogedor con luz cálida y fondo desenfocado.' },
  { id: 'estudio', label: 'Fondo limpio', hint: 'Fondo liso de estudio. Ideal para promos y menús.' },
  { id: 'temporada', label: 'De temporada', hint: 'Decoración sutil de la fecha especial, sin tapar tu producto.' }
];

export const SEASON_LABEL: Record<Season, string> = {
  navidad: 'Navidad', fin_de_ano: 'Fin de año', san_valentin: 'San Valentín', dia_madre: 'Día de la Madre',
  dia_padre: 'Día del Padre', halloween: 'Halloween', verano: 'Vacaciones de verano'
};

const SEASON_PROMPT: Record<Season, string> = {
  navidad: 'subtle Christmas decoration (pine branches, warm fairy lights, a few red and gold ornaments)',
  fin_de_ano: 'subtle New Year celebration mood (golden bokeh lights, a little confetti, festive but elegant)',
  san_valentin: "subtle Valentine's Day mood (soft pink and red tones, a few small hearts or rose petals)",
  dia_madre: "subtle Mother's Day mood (soft pastel flowers, delicate and warm)",
  dia_padre: "subtle Father's Day mood (warm wood tones, elegant and simple)",
  halloween: 'subtle Halloween mood (a few small pumpkins, warm orange light), friendly not scary',
  verano: 'bright sunny summer mood (natural daylight, fresh colors, light tropical touch)'
};

/** Qué se ve en la foto según el negocio, para que la instrucción sea precisa. */
function subjectOf(type: BusinessType): string {
  if (type === 'restaurante' || type === 'cafeteria' || type === 'panaderia') return 'food or drink';
  if (type === 'floristeria') return 'flowers or arrangement';
  if (type === 'gimnasio') return 'gym space or people training';
  if (type === 'barberia' || type === 'peluqueria' || type === 'spa') return 'service, space or result';
  return 'product or space';
}

const KEEP = 'Keep the main subject exactly the same: same shape, ingredients, colors, portions and details; do not add or remove items from it. Do not add any text, letters, logos or watermarks. Photorealistic, natural, appetizing, not artificial.';

export function stylePrompt(style: PhotoStyle, type: BusinessType, season?: Season): string {
  const s = subjectOf(type);
  switch (style) {
    case 'profesional':
      return `Professional retouch of this photo of a ${s}: improve lighting, white balance, color and sharpness like a magazine photo, gently clean distracting background elements. ${KEEP}`;
    case 'ambiente':
      return `Place this ${s} in an inviting, cozy setting that fits a small local business in Ecuador: warm ambient light, tasteful props, shallow depth of field with a softly blurred background. ${KEEP}`;
    case 'estudio':
      return `Studio photo of this ${s} on a clean, seamless light background with soft shadows and even professional lighting, centered with space around it. ${KEEP}`;
    case 'temporada':
      return `Keep this ${s} as the hero and add ${SEASON_PROMPT[season ?? 'navidad']} around it, without covering it. ${KEEP}`;
  }
}

/** Fecha especial más cercana (próximas ~5 semanas) para recomendar el estilo "De temporada". */
export function upcomingSeason(now: Date = new Date()): Season | null {
  const m = now.getUTCMonth() + 1, d = now.getUTCDate();
  const md = m * 100 + d;
  if (md >= 1115 && md <= 1226) return 'navidad';
  if (md >= 1227 || md <= 102) return 'fin_de_ano';
  if (md >= 115 && md <= 214) return 'san_valentin';
  if (md >= 410 && md <= 512) return 'dia_madre';           // Ecuador: segundo domingo de mayo
  if (md >= 515 && md <= 621) return 'dia_padre';           // Ecuador: tercer domingo de junio
  if (md >= 1001 && md <= 1031) return 'halloween';
  if ((md >= 701 && md <= 831) || (md >= 1210 && md <= 1231)) return 'verano';
  return null;
}

export interface PhotoAdvice { style: PhotoStyle; season?: Season; why: string }

/** Recomendación sin IA (sin costo) de qué hacer con la foto. */
export function recommendStyles(type: BusinessType, now: Date = new Date()): PhotoAdvice[] {
  const out: PhotoAdvice[] = [];
  const season = upcomingSeason(now);
  if (season) out.push({ style: 'temporada', season, why: `Se acerca ${SEASON_LABEL[season]}: un toque de temporada llama la atención en el feed.` });
  const food = type === 'restaurante' || type === 'cafeteria' || type === 'panaderia';
  out.push(food
    ? { style: 'profesional', why: 'Para comida, mejor luz y color es lo que más antojo genera.' }
    : { style: 'profesional', why: 'Mejorar luz y nitidez hace que tu foto se vea profesional.' });
  out.push(food || type === 'floristeria' || type === 'tienda'
    ? { style: 'estudio', why: 'Fondo limpio para promos, menús y combos: se lee mejor el mensaje.' }
    : { style: 'ambiente', why: 'Un ambiente acogedor transmite cómo se siente estar en tu local.' });
  return out;
}

/** Nombre de archivo de una foto de Marketing (también sirve como id en la URL de la imagen). */
export const PHOTO_ID_RE = /^m-\d{13}-[a-z0-9]{6}\.(jpg|png)$/;

export function newPhotoId(ext: 'jpg' | 'png', now: number = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `m-${now}-${rand}.${ext}`;
}

export const MAX_MARKETING_PHOTO_BYTES = 6 * 1024 * 1024;

export function validateMarketingPhoto(file: { bytes: Uint8Array; contentType: string }): string | null {
  if (!file?.bytes?.byteLength) return 'Elige una foto.';
  if (file.contentType !== 'image/jpeg' && file.contentType !== 'image/png') return 'La foto debe ser JPG o PNG.';
  if (file.bytes.byteLength > MAX_MARKETING_PHOTO_BYTES) return 'La foto pesa más de 6 MB.';
  const b = file.bytes;
  const ok = file.contentType === 'image/png'
    ? b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return ok ? null : 'El archivo no parece una foto válida.';
}

/** Diseños de la imagen del post. Con foto, la foto manda; sin foto, el color de la marca. */
export const PHOTO_DESIGNS = ['impacto', 'marco', 'dividido', 'limpio'] as const;
export const PLAIN_DESIGNS = ['color', 'claro', 'numero'] as const;
export type PostDesign = (typeof PHOTO_DESIGNS)[number] | (typeof PLAIN_DESIGNS)[number];

export const DESIGN_LABEL: Record<PostDesign, string> = {
  impacto: 'Impacto', marco: 'Con marco', dividido: 'Dividido', limpio: 'Limpio',
  color: 'Tus colores', claro: 'Claro', numero: 'Cifra grande'
};
