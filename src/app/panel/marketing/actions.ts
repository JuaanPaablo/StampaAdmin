'use server';

import { z } from 'zod';
import { getContext } from '@/lib/context';
import { generate, loadInsights, type GenerateResult } from '@/lib/marketing/service';

const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'Estado de WhatsApp'] as const;

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('post'), topic: z.string().trim().min(3, 'Cuéntanos de qué quieres el post.').max(300, 'Máximo 300 letras.'), channel: z.enum(CHANNELS) }),
  z.object({ kind: z.literal('data_post'), insightId: z.string().min(1).max(40), channel: z.enum(CHANNELS) }),
  z.object({ kind: z.literal('calendar') }),
  z.object({ kind: z.literal('review_reply'), review: z.string().trim().min(5, 'Pega la reseña.').max(1500, 'La reseña es muy larga (máximo 1500 letras).'), stars: z.coerce.number().int().min(1).max(5) })
]);

/** Genera textos de marketing. Los datos del negocio y las ideas se calculan en el servidor (no se confía en el navegador). */
export async function generateMarketingAction(input: unknown): Promise<GenerateResult> {
  const ctx = await getContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  const req = parsed.data;
  if (req.kind === 'post') return generate(ctx, req);
  if (req.kind === 'review_reply') return generate(ctx, req);
  const insights = await loadInsights(ctx);
  if (req.kind === 'data_post') {
    const idea = insights.find((i) => i.id === req.insightId);
    if (!idea) return { ok: false, error: 'Esa idea ya no está disponible. Recarga la página.' };
    return generate(ctx, { kind: 'data_post', insightId: idea.id, fact: idea.fact, channel: req.channel });
  }
  return generate(ctx, { kind: 'calendar', facts: insights.map((i) => i.fact).slice(0, 6) });
}
