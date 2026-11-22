
/**
 * Cliente mínimo de DeepSeek (API compatible con OpenAI). Solo corre en el servidor: la clave vive en la variable de
 * entorno DEEPSEEK_API_KEY de Vercel y nunca llega al navegador.
 *
 * Ahorro de créditos:
 * - Modelo Flash (el más barato) y sin modo de razonamiento.
 * - Respuesta en JSON con un tope de tokens.
 * - El mensaje de sistema es siempre igual al inicio, así DeepSeek cobra esa parte como "cache hit" (mucho más barato).
 */

const BASE_URL = 'https://api.deepseek.com';
/** Orden de preferencia: el nombre actual del modelo Flash y sus alias anteriores. DEEPSEEK_MODEL lo fija a mano. */
const MODEL_CANDIDATES = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-chat'];
let workingModel: string | null = null;

export interface AiUsage { model: string; promptTokens: number; cachedTokens: number; completionTokens: number }
export interface AiJsonResult<T> { data: T; usage: AiUsage }

export class AiError extends Error {}

export function aiConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

interface ChatMessage { role: 'system' | 'user'; content: string }

async function call(model: string, messages: ChatMessage[], maxTokens: number, temperature: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    return await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model, messages, max_tokens: maxTokens, temperature, stream: false,
        response_format: { type: 'json_object' }
      }),
      signal: ctrl.signal,
      cache: 'no-store'
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Pide una respuesta en JSON. Lanza AiError con un mensaje en español si algo falla. */
export async function chatJson<T>(messages: ChatMessage[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<AiJsonResult<T>> {
  if (!aiConfigured()) throw new AiError('La generación con IA no está configurada todavía.');
  const maxTokens = opts.maxTokens ?? 900;
  const temperature = opts.temperature ?? 1.1;
  const candidates = process.env.DEEPSEEK_MODEL ? [process.env.DEEPSEEK_MODEL] : workingModel ? [workingModel] : MODEL_CANDIDATES;

  let res: Response | null = null;
  let model = candidates[0];
  for (const m of candidates) {
    model = m;
    try {
      res = await call(m, messages, maxTokens, temperature);
    } catch (e) {
      throw new AiError((e as Error).name === 'AbortError' ? 'La IA tardó demasiado. Intenta de nuevo.' : 'No pudimos conectar con la IA. Intenta de nuevo.');
    }
    if (res.ok) break;
    // Modelo inexistente o retirado: prueba el siguiente nombre.
    if ((res.status === 400 || res.status === 404) && /model/i.test(await res.clone().text())) continue;
    break;
  }
  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    if (status === 401 || status === 403) throw new AiError('La clave de la IA no es válida. Avísale a Stampa.');
    if (status === 402) throw new AiError('Se acabó el saldo de la IA. Avísale a Stampa.');
    if (status === 429) throw new AiError('La IA está muy ocupada. Intenta en un minuto.');
    throw new AiError('La IA no respondió bien. Intenta de nuevo.');
  }
  workingModel = model;

  const body = await res.json() as {
    choices?: { finish_reason?: string; message?: { content?: string; reasoning_content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
  };
  const choice = body.choices?.[0];
  const content = choice?.message?.content ?? '';
  const data = parseJsonLoose<T>(content);
  if (data === undefined) {
    // Diagnóstico sin datos sensibles: motivo de corte y tamaños.
    console.warn('[deepseek] respuesta ilegible', JSON.stringify({
      model, finish: choice?.finish_reason, len: content.length, reasoning: choice?.message?.reasoning_content?.length ?? 0,
      usage: body.usage, head: content.slice(0, 160), tail: content.slice(-80)
    }));
    throw new AiError(choice?.finish_reason === 'length'
      ? 'La respuesta salió muy larga y se cortó. Intenta de nuevo.'
      : 'La IA respondió algo que no pudimos leer. Intenta de nuevo.');
  }
  return {
    data,
    usage: {
      model,
      promptTokens: body.usage?.prompt_tokens ?? 0,
      cachedTokens: body.usage?.prompt_cache_hit_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0
    }
  };
}

/** JSON.parse tolerante: quita cercas ```json y toma del primer "{" al último "}". */
export function parseJsonLoose<T>(raw: string): T | undefined {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(s) as T; } catch { /* sigue */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)) as T; } catch { /* nada */ } }
  return undefined;
}
