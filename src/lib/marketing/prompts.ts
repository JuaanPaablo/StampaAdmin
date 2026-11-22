import type { MarketingKind } from '../contracts';

/**
 * Instrucciones para la IA. El mensaje de sistema es IDÉNTICO en todas las llamadas (no lleva datos del negocio): así
 * DeepSeek lo cobra como "cache hit", que cuesta una fracción del precio normal. Lo que cambia va en el mensaje del
 * usuario.
 */
export const SYSTEM_PROMPT = `Eres el community manager de pequeños negocios de Ecuador que usan Stampa, una tarjeta de sellos digital (el cliente escanea un QR en caja, sin descargar apps, y junta sellos para ganar premios).
Escribes en español de Ecuador, tuteando, con frases cortas, cálidas y claras. Nada de anglicismos innecesarios.
Reglas:
- Usa SOLO los datos que te dan. No inventes precios, descuentos, horarios, direcciones ni productos.
- Si propones una promoción y el dueño no te dio el beneficio, escríbelo entre corchetes para que lo complete, por ejemplo [tu promoción].
- Nunca menciones nombres de clientes ni datos personales.
- Termina los textos de redes con una invitación a sumarse al club escaneando el QR en caja.
- Emojis con moderación (2 a 4 por texto). Hashtags en minúsculas, sin tildes, de 5 a 8, mezcla generales y locales (ciudad).
- "titulo" va en la imagen: máximo 6 palabras. "subtitulo": máximo 12 palabras.
Responde SIEMPRE en JSON válido con exactamente la estructura que se te pida, sin texto fuera del JSON.`;

export interface BusinessBrief {
  name: string;
  typeLabel: string;
  city?: string;
  province?: string;
  stampsRequired: number;
  rewardTitle: string;
  milestones: { at: number; title: string }[];
  birthdayReward?: string;
  customerWord: string;
}

function brief(b: BusinessBrief): string {
  const lines = [
    `Negocio: ${b.name} (${b.typeLabel})${b.city ? `, en ${b.city}${b.province ? `, ${b.province}` : ''}` : ''}.`,
    `Tarjeta: junta ${b.stampsRequired} sellos y gana ${b.rewardTitle}.`,
    b.milestones.length ? `Premios en el camino: ${b.milestones.map((m) => `sello ${m.at}: ${m.title}`).join('; ')}.` : '',
    b.birthdayReward ? `Regalo de cumpleaños: ${b.birthdayReward}.` : '',
    `A sus clientes les dice "${b.customerWord}".`
  ];
  return lines.filter(Boolean).join('\n');
}

const POST_SHAPE = '{"opciones":[{"titulo":"…","subtitulo":"…","texto":"texto para la publicación (300 a 600 caracteres)","hashtags":["…"]}]} con 3 opciones distintas entre sí (una divertida, una cálida y una directa).';

export function postMessages(b: BusinessBrief, topic: string, channel: string) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `${brief(b)}\n\nRed social: ${channel}.\nTema del post: ${topic}\n\nDevuelve JSON: ${POST_SHAPE}` }
  ];
}

export function dataPostMessages(b: BusinessBrief, fact: string, channel: string) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `${brief(b)}\n\nRed social: ${channel}.\nDato real del negocio para el post: ${fact}\n\nDevuelve JSON: ${POST_SHAPE}` }
  ];
}

export function calendarMessages(b: BusinessBrief, facts: string[]) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `${brief(b)}\n\nDatos reales para inspirarte:\n${facts.map((f) => `- ${f}`).join('\n')}\n\nArma el plan de publicaciones de esta semana: 5 posts de lunes a viernes, variados (premio, comunidad, producto, detrás de cámaras, promo). Devuelve JSON: {"dias":[{"dia":"lunes","idea":"de qué trata en una frase","titulo":"…","texto":"texto listo (250 a 450 caracteres)","hashtags":["…"]}]}`
    }
  ];
}

export function reviewMessages(b: BusinessBrief, review: string, stars: number) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `${brief(b)}\n\nReseña de Google (${stars} de 5 estrellas):\n"""${review}"""\n\nEscribe 2 respuestas públicas del dueño a esta reseña: amables, breves (máximo 500 caracteres), sin emojis excesivos y sin hashtags. Si la reseña es negativa, agradece, pide disculpas sin excusas y ofrece seguir la conversación por mensaje privado. No ofrezcas regalos ni descuentos. Devuelve JSON: {"respuestas":["…","…"]}`
    }
  ];
}

/* ---------- Lectura segura de la respuesta ---------- */

export interface PostOption { titulo: string; subtitulo: string; texto: string; hashtags: string[] }
export interface CalendarDay { dia: string; idea: string; titulo: string; texto: string; hashtags: string[] }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const tags = (v: unknown) => (Array.isArray(v) ? v : [])
  .map((t) => String(t).trim().replace(/^#*/, '').replace(/\s+/g, '').toLowerCase())
  .filter((t) => /^[\p{L}\p{N}_]{2,40}$/u.test(t)).slice(0, 10);

export function readPostOptions(data: unknown): PostOption[] {
  const list = (data as { opciones?: unknown[] })?.opciones;
  if (!Array.isArray(list)) return [];
  return list.map((o) => {
    const x = o as Record<string, unknown>;
    return { titulo: str(x.titulo, 60), subtitulo: str(x.subtitulo, 110), texto: str(x.texto, 1500), hashtags: tags(x.hashtags) };
  }).filter((o) => o.texto).slice(0, 3);
}

export function readCalendar(data: unknown): CalendarDay[] {
  const list = (data as { dias?: unknown[] })?.dias;
  if (!Array.isArray(list)) return [];
  return list.map((o) => {
    const x = o as Record<string, unknown>;
    return { dia: str(x.dia, 20), idea: str(x.idea, 200), titulo: str(x.titulo, 60), texto: str(x.texto, 1200), hashtags: tags(x.hashtags) };
  }).filter((d) => d.texto).slice(0, 7);
}

export function readReplies(data: unknown): string[] {
  const list = (data as { respuestas?: unknown[] })?.respuestas;
  return Array.isArray(list) ? list.map((r) => str(r, 800)).filter(Boolean).slice(0, 3) : [];
}

export const KIND_LABEL: Record<MarketingKind, string> = {
  post: 'Post', data_post: 'Post con tus datos', calendar: 'Calendario semanal', review_reply: 'Respuesta a reseña', photo_edit: 'Foto mejorada'
};

/** Respuesta de ejemplo cuando no hay clave de IA (desarrollo local y pruebas). No consume créditos. */
export function sampleOutput(kind: MarketingKind, b: BusinessBrief): unknown {
  const opt = (n: number): PostOption => ({
    titulo: ['¡Tu sello te espera!', 'Junta y gana', 'Ven por tu premio'][n],
    subtitulo: `${b.stampsRequired} sellos y te llevas ${b.rewardTitle}`,
    texto: `En ${b.name} cada visita cuenta 🙌 Escanea el QR en caja, suma tu sello y al llegar a ${b.stampsRequired} te llevas ${b.rewardTitle}. ¡Sin apps! (Texto de ejemplo: falta la clave de IA.)`,
    hashtags: ['stampa', 'fidelidad', 'ecuador']
  });
  if (kind === 'calendar') return { dias: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'].map((dia, i) => ({ dia, idea: 'Idea de ejemplo', ...opt(i % 3) })) };
  if (kind === 'review_reply') return { respuestas: ['¡Gracias por tu visita y por tomarte el tiempo de escribirnos! (ejemplo)', 'Nos alegra mucho leerte. ¡Te esperamos pronto! (ejemplo)'] };
  return { opciones: [opt(0), opt(1), opt(2)] };
}
