import type { CustomerSegment, MarketingKind } from '../contracts';
import { buildInsights, type Insight } from './insights';
import type { PanelContext } from '../context';
import { features } from '../plans';
import { aiConfigured, AiError, chatJson } from '../ai/deepseek';
import {
  calendarMessages, dataPostMessages, postMessages, readCalendar, readPostOptions, readReplies, reviewMessages, sampleOutput,
  type BusinessBrief, type CalendarDay, type PostOption
} from './prompts';

/** Inicio del mes actual en la zona del negocio, en ISO (para el límite mensual). */
export function monthStartIso(timeZone: string, nowMs: number = Date.now()): string {
  let y = 0, m = 0;
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(nowMs));
    y = Number(p.find((x) => x.type === 'year')?.value); m = Number(p.find((x) => x.type === 'month')?.value);
  } catch { /* zona inválida */ }
  if (!y || !m) { const d = new Date(nowMs - 5 * 3_600_000); y = d.getUTCFullYear(); m = d.getUTCMonth() + 1; }
  // Medianoche local ≈ 05:00 UTC en Ecuador; con otras zonas basta un margen de horas para el límite mensual.
  const offsetH = timeZone === 'Pacific/Galapagos' ? 6 : 5;
  return new Date(Date.UTC(y, m - 1, 1, offsetH)).toISOString();
}

export function briefOf(ctx: PanelContext): BusinessBrief {
  const { business, program, template } = ctx;
  return {
    name: business.name, typeLabel: template.label, city: business.city, province: business.province,
    stampsRequired: program.stampsRequired, rewardTitle: program.rewardTitle,
    milestones: (program.milestones ?? []).filter((m) => m.at < program.stampsRequired),
    birthdayReward: program.birthdayReward, customerWord: template.vocab.customers
  };
}

export interface Quota { used: number; limit: number; left: number }

export async function quotaOf(ctx: PanelContext): Promise<Quota> {
  const limit = features(ctx.business.plan).aiTexts;
  const used = await ctx.repo.countMarketingSince(ctx.business.id, monthStartIso(ctx.business.timezone));
  return { used, limit, left: Math.max(0, limit - used) };
}

export type GenerateRequest =
  | { kind: 'post'; topic: string; channel: string }
  | { kind: 'data_post'; insightId: string; fact: string; channel: string }
  | { kind: 'calendar'; facts: string[] }
  | { kind: 'review_reply'; review: string; stars: number };

export type GenerateResult =
  | { ok: true; id: string; kind: MarketingKind; options?: PostOption[]; days?: CalendarDay[]; replies?: string[]; quota: Quota; sample: boolean }
  | { ok: false; error: string; quota?: Quota };

/** Valida plan, rol y límite; llama a la IA (o al ejemplo si no hay clave) y deja registro. */
export async function generate(ctx: PanelContext, req: GenerateRequest): Promise<GenerateResult> {
  if (ctx.staff.role === 'cashier') return { ok: false, error: 'Marketing es para el dueño o un gerente.' };
  const f = features(ctx.business.plan);
  if (req.kind === 'data_post' && !f.dataPosts) return { ok: false, error: 'Los posts con tus datos están disponibles desde el plan Standard.' };
  if (req.kind === 'calendar' && !f.aiCalendar) return { ok: false, error: 'El calendario semanal está disponible en el plan Pro.' };
  if (req.kind === 'review_reply' && !f.aiReviews) return { ok: false, error: 'Las respuestas a reseñas están disponibles en el plan Pro.' };

  const quota = await quotaOf(ctx);
  if (quota.left <= 0) return { ok: false, error: `Ya usaste tus ${quota.limit} textos de este mes. Se renuevan el 1 del próximo mes.`, quota };
  const lastMinute = await ctx.repo.countMarketingSince(ctx.business.id, new Date(Date.now() - 60_000).toISOString());
  if (lastMinute >= 4) return { ok: false, error: 'Vas muy rápido. Espera un minuto y vuelve a intentar.', quota };

  const b = briefOf(ctx);
  const messages =
    req.kind === 'post' ? postMessages(b, req.topic, req.channel)
      : req.kind === 'data_post' ? dataPostMessages(b, req.fact, req.channel)
        : req.kind === 'calendar' ? calendarMessages(b, req.facts)
          : reviewMessages(b, req.review, req.stars);
  const maxTokens = req.kind === 'calendar' ? 3000 : req.kind === 'review_reply' ? 1000 : 2000;

  const sample = !aiConfigured();
  let data: unknown;
  let usage = { model: 'ejemplo', promptTokens: 0, cachedTokens: 0, completionTokens: 0 };
  if (sample) {
    // Sin clave solo se permite en desarrollo: en producción es un error de configuración.
    if (process.env.VERCEL_ENV === 'production') return { ok: false, error: 'La generación con IA no está configurada todavía. Avísale a Stampa.', quota };
    data = sampleOutput(req.kind, b);
  } else {
    try {
      const r = await chatJson<unknown>(messages, { maxTokens, temperature: req.kind === 'review_reply' ? 0.7 : 1.1 });
      data = r.data; usage = r.usage;
    } catch (e) {
      return { ok: false, error: e instanceof AiError ? e.message : 'No pudimos generar el texto. Intenta de nuevo.', quota };
    }
  }

  const options = req.kind === 'post' || req.kind === 'data_post' ? readPostOptions(data) : undefined;
  const days = req.kind === 'calendar' ? readCalendar(data) : undefined;
  const replies = req.kind === 'review_reply' ? readReplies(data) : undefined;
  if ((options && !options.length) || (days && !days.length) || (replies && !replies.length)) {
    return { ok: false, error: 'La IA respondió algo incompleto. Intenta de nuevo (no se descontó de tu límite).', quota };
  }

  const topic = req.kind === 'post' ? req.topic : req.kind === 'data_post' ? req.insightId : req.kind === 'review_reply' ? req.review.slice(0, 200) : 'semana';
  const rec = await ctx.repo.recordMarketing(ctx.business.id, {
    staffId: ctx.staff.id, kind: req.kind, topic, output: options ? { options } : days ? { days } : { replies },
    model: usage.model, promptTokens: usage.promptTokens, cachedTokens: usage.cachedTokens, completionTokens: usage.completionTokens
  });
  const used = quota.used + 1;
  return { ok: true, id: rec.id, kind: req.kind, options, days, replies, sample, quota: { used, limit: quota.limit, left: Math.max(0, quota.limit - used) } };
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Ideas con los datos reales del negocio (últimos 30 días). Sin IA: no cuesta créditos. */
export async function loadInsights(ctx: PanelContext): Promise<Insight[]> {
  const [dash, customers] = await Promise.all([ctx.repo.getDashboard(ctx.business.id, '30d'), ctx.repo.listCustomers(ctx.business.id)]);
  const segments: Partial<Record<CustomerSegment, number>> = {};
  for (const c of customers) segments[c.segment] = (segments[c.segment] ?? 0) + 1;
  let month = MONTHS[new Date().getUTCMonth()];
  try { month = new Intl.DateTimeFormat('es-EC', { month: 'long', timeZone: ctx.business.timezone }).format(new Date()); } catch { /* usa UTC */ }
  return buildInsights({
    dash, totalCustomers: customers.length, segments, program: ctx.program, customerWord: ctx.template.vocab.customers, monthName: month
  });
}
