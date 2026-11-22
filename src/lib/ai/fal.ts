/**
 * Edición de fotos con IA vía fal.ai (solo servidor). La clave vive en FAL_KEY (Vercel, Sensitive) y nunca llega al
 * navegador. Modelo por defecto: Seedream 5.0 Lite Edit (~US$0,035 por imagen); FAL_IMAGE_MODEL lo cambia sin tocar
 * código, por ejemplo a "fal-ai/flux-pro/kontext" si algún día conviene más.
 *
 * DeepSeek no sirve aquí: su API solo trabaja con texto.
 */

const DEFAULT_MODEL = 'fal-ai/bytedance/seedream/v5/lite/edit';

export class ImageAiError extends Error {}

export function imageAiConfigured(): boolean {
  return !!process.env.FAL_KEY;
}

export function imageModel(): string {
  return process.env.FAL_IMAGE_MODEL || DEFAULT_MODEL;
}

/** Edita una foto (URL pública https) según la instrucción y devuelve la URL temporal del resultado en fal. */
export async function editPhoto(imageUrl: string, prompt: string): Promise<{ url: string; model: string }> {
  if (!imageAiConfigured()) throw new ImageAiError('La mejora de fotos con IA no está configurada todavía.');
  const model = imageModel();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  let res: Response;
  try {
    res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${process.env.FAL_KEY}` },
      body: JSON.stringify({ prompt, image_urls: [imageUrl], num_images: 1, output_format: 'jpeg', enable_safety_checker: true }),
      signal: ctrl.signal,
      cache: 'no-store'
    });
  } catch (e) {
    throw new ImageAiError((e as Error).name === 'AbortError' ? 'La IA tardó demasiado con la foto. Intenta de nuevo.' : 'No pudimos conectar con la IA de imágenes.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    console.warn('[fal] error', res.status, text.replace(/Key\s+\S+/g, 'Key ***'));
    if (res.status === 401 || res.status === 403) throw new ImageAiError('La clave de la IA de imágenes no es válida. Avísale a Stampa.');
    if (res.status === 402 || /balance|credit|billing/i.test(text)) throw new ImageAiError('Se acabó el saldo de la IA de imágenes. Avísale a Stampa.');
    if (res.status === 422) throw new ImageAiError('La IA no pudo usar esa foto. Prueba con otra (JPG o PNG, bien iluminada).');
    throw new ImageAiError('La IA de imágenes no respondió bien. Intenta de nuevo.');
  }
  const body = await res.json() as { images?: { url?: string }[] };
  const url = body.images?.[0]?.url;
  if (!url || !/^https:\/\//.test(url)) throw new ImageAiError('La IA no devolvió una imagen. Intenta de nuevo.');
  return { url, model };
}
