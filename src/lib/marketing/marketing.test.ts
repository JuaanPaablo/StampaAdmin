import { describe, expect, it } from 'vitest';
import { buildInsights, roundMilestone } from './insights';
import { readPostOptions, readReplies, SYSTEM_PROMPT, postMessages } from './prompts';
import { monthStartIso } from './service';
import { features, planOf, planPrice } from '../plans';
import { createMemoryRepo } from '../repo/memory';
import type { DashboardData } from '../contracts';

const dash = (o: Partial<DashboardData> = {}): DashboardData => ({
  range: '30d',
  kpis: { stampsIssued: 200, activeCustomers: 40, newCustomers: 12, rewardsRedeemed: 7, returnRate: 0.5, stampsPerTicket: 1.1 },
  previous: { stampsIssued: 150, activeCustomers: 30, newCustomers: 6, rewardsRedeemed: 3 },
  series: [],
  byHour: [{ hour: 13, stamps: 40 }, { hour: 20, stamps: 60 }],
  byWeekday: [5, 10, 30, 30, 40, 50, 35].map((stamps, weekday) => ({ weekday, stamps })),
  topCustomers: [],
  upcomingBirthdays: [],
  ...o
});
const program = { stampsRequired: 8, rewardTitle: 'Una pizza mediana', milestones: [{ at: 4, title: 'Una bebida' }], birthdayReward: undefined };

describe('planes', () => {
  it('mapea nombres viejos y da precios con IVA', () => {
    expect(planOf('gratis')).toBe('basico');
    expect(planOf('negocio')).toBe('standard');
    expect(planPrice('pro')).toBe('$79,99');
    expect(features('basico').aiTexts).toBe(10);
    expect(features('standard').dataPosts).toBe(true);
    expect(features('basico').dataPosts).toBe(false);
    expect(features('pro').aiCalendar).toBe(true);
  });
});

describe('ideas con datos', () => {
  it('redondea cifras celebrables', () => {
    expect(roundMilestone(47)).toBe(40);
    expect(roundMilestone(1080)).toBe(1000);
    expect(roundMilestone(7)).toBe(7);
  });

  it('propone día flojo, hora pico, premios, comunidad y nuevos', () => {
    const ids = buildInsights({ dash: dash(), totalCustomers: 73, segments: { en_riesgo: 4 }, program, customerWord: 'comensales', monthName: 'noviembre' }).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['comunidad', 'dia-flojo', 'hora-pico', 'premios', 'premio', 'te-extranamos', 'bienvenida']));
  });

  it('el día flojo es el de menos sellos y no incluye nombres', () => {
    const list = buildInsights({ dash: dash(), totalCustomers: 5, segments: {}, program, customerWord: 'clientes', monthName: 'noviembre' });
    expect(list.find((i) => i.id === 'dia-flojo')?.title).toBe('Dale vida al domingo');
    expect(list.find((i) => i.id === 'comunidad')).toBeUndefined();
  });

  it('sin datos solo queda la idea del premio', () => {
    const empty = dash({ kpis: { stampsIssued: 0, activeCustomers: 0, newCustomers: 0, rewardsRedeemed: 0, returnRate: 0, stampsPerTicket: 0 }, byHour: [], byWeekday: [] });
    expect(buildInsights({ dash: empty, totalCustomers: 0, segments: {}, program, customerWord: 'clientes', monthName: 'x' }).map((i) => i.id)).toEqual(['premio']);
  });
});

describe('prompts', () => {
  it('el mensaje de sistema no cambia entre negocios (cache de DeepSeek)', () => {
    const b = { name: 'A', typeLabel: 'Pizzería', stampsRequired: 8, rewardTitle: 'x', milestones: [], customerWord: 'clientes' };
    expect(postMessages(b, 't', 'Instagram')[0].content).toBe(SYSTEM_PROMPT);
    expect(postMessages({ ...b, name: 'B' }, 'u', 'TikTok')[0].content).toBe(SYSTEM_PROMPT);
  });

  it('lee las opciones con límites y limpia hashtags', () => {
    const r = readPostOptions({ opciones: [{ titulo: 'Hola', subtitulo: 's', texto: 'texto', hashtags: ['#Pizza Quito', 'ok', '<x>'] }, { texto: '' }] });
    expect(r).toHaveLength(1);
    expect(r[0].hashtags).toEqual(['pizzaquito', 'ok']);
    expect(readPostOptions('nada')).toEqual([]);
    expect(readReplies({ respuestas: ['a', 2, ''] })).toEqual(['a']);
  });
});

describe('mes de marketing', () => {
  it('empieza a medianoche de Ecuador', () => {
    expect(monthStartIso('America/Guayaquil', Date.parse('2026-11-22T12:00:00Z'))).toBe('2026-11-01T05:00:00.000Z');
    // 1 de diciembre a las 02:00 UTC sigue siendo 30 de noviembre en Ecuador.
    expect(monthStartIso('America/Guayaquil', Date.parse('2026-12-01T02:00:00Z'))).toBe('2026-11-01T05:00:00.000Z');
  });
});

describe('repo de marketing', () => {
  it('registra, cuenta y suma uso', async () => {
    const repo = createMemoryRepo();
    const biz = (await repo.listBusinesses())[0];
    if (!biz) return;
    await repo.recordMarketing(biz.id, { kind: 'post', topic: 't', output: {}, promptTokens: 100, cachedTokens: 80, completionTokens: 50 });
    await repo.recordMarketing(biz.id, { kind: 'data_post', output: {} });
    expect(await repo.countMarketingSince(biz.id, '2000-01-01T00:00:00Z')).toBe(2);
    expect((await repo.listMarketing(biz.id))[0].kind).toBe('data_post');
    expect((await repo.marketingUsage('2000-01-01T00:00:00Z'))[biz.id]).toEqual({ count: 2, promptTokens: 100, cachedTokens: 80, completionTokens: 50 });
  });
});

describe('json tolerante', async () => {
  const { parseJsonLoose } = await import('../ai/deepseek');
  it('acepta cercas y texto alrededor', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Aquí va: {"a":2} listo')).toEqual({ a: 2 });
    expect(parseJsonLoose('{"a":')).toBeUndefined();
  });
});
