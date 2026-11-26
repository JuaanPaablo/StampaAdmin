import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepo } from '../repo/memory';
import type { Repo } from '../repo';
import { notifyCustomer, OFFER_BATCH_SIZE, offerSentKind, syncOfferBatch } from './notify';

const g = globalThis as unknown as { __stampaRepo?: Repo };
let saved: NodeJS.ProcessEnv;
beforeEach(() => {
  saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (k.startsWith('GOOGLE_WALLET_') || k.startsWith('APPLE_')) delete process.env[k];
});
afterEach(() => { process.env = saved; g.__stampaRepo = undefined; });

describe('avisos en Wallet', () => {
  it('sin Google ni Apple configurados no avisa ni lanza', async () => {
    expect(await notifyCustomer('biz_x', 'cli_x', 'Hola', 'offer')).toEqual({ sent: false, reason: 'disabled' });
  });

  it('el kind del aviso de un cupón cabe en 40 caracteres', () => {
    expect(offerSentKind('ofr_0123456789')).toBe('offer.sent:ofr_0123456789');
    expect(offerSentKind('x'.repeat(80)).length).toBe(40);
  });
});

describe('syncOfferBatch (tandas)', () => {
  it('recorre todos los cupones entregados por cursor, sin repetir ni saltar', async () => {
    const repo = createMemoryRepo();
    g.__stampaRepo = repo;
    const fake = Array.from({ length: OFFER_BATCH_SIZE * 2 + 3 }, (_, i) => ({ id: `cof_${String(i).padStart(3, '0')}`, customerId: `cli_${i}` }));
    vi.spyOn(repo, 'getOffer').mockResolvedValue({ id: 'ofr_1', businessId: 'biz_1', title: 'T', description: 'D', startsAt: new Date(0).toISOString(), endsAt: new Date(Date.now() + 1e9).toISOString(), status: 'sent', sentAt: new Date().toISOString(), createdAt: new Date().toISOString() });
    vi.spyOn(repo, 'listCustomerOfferPage').mockImplementation(async (_b, _o, opts) => {
      const items = fake.filter((c) => !opts.afterId || c.id > opts.afterId).slice(0, opts.limit);
      return { items, total: fake.length };
    });
    const seen: number[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const r = await syncOfferBatch('biz_1', 'ofr_1', 'send', cursor);
      seen.push(r.processed);
      expect(r.total).toBe(fake.length);
      if (!r.nextCursor) break;
      cursor = r.nextCursor;
    }
    expect(seen).toEqual([OFFER_BATCH_SIZE, OFFER_BATCH_SIZE, 3]);
  });

  it('un borrador o un cupón que no existe no procesa nada', async () => {
    g.__stampaRepo = createMemoryRepo();
    expect(await syncOfferBatch('biz_x', 'ofr_x', 'send')).toMatchObject({ processed: 0, total: 0, nextCursor: null });
  });
});
