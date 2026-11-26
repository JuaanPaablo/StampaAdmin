import { describe, expect, it } from 'vitest';
import type { GiftCard } from '@/lib/contracts';
import { filterGiftCards, giftCodeSpaced, giftQrValue, giftTotals, parseGiftFilter } from './gift-format';

const card = (p: Partial<GiftCard>): GiftCard => ({
  id: 'gft_1', businessId: 'b', code: 'ABCDEFGHJKMN', balanceCents: 1000, initialCents: 1000, status: 'active', createdAt: '2026-11-01T00:00:00Z', ...p
});

const cards = [
  card({ id: 'a', code: 'ABCDEFGHJKMN', customerId: 'c1', balanceCents: 2500 }),
  card({ id: 'b', code: 'PQRSTUVWXYZ2', customerId: 'c2', balanceCents: 0 }),
  card({ id: 'c', code: 'ZZZZYYYYXXXX', status: 'void', balanceCents: 0, initialCents: 3000 }),
  card({ id: 'd', code: 'MNPQ23456789', balanceCents: 1500 })
];
const names: Record<string, string> = { c1: 'José Pérez', c2: 'Ana Ruiz' };
const nameOf = (id?: string) => (id ? names[id] : undefined);

describe('gift-format', () => {
  it('QR y código legible', () => {
    expect(giftQrValue('ABCDEFGHJKMN')).toBe('STAMPA-GIFT:ABCDEFGHJKMN');
    expect(giftCodeSpaced('ABCDEFGHJKMN')).toBe('ABCD EFGH JKMN');
  });

  it('filtro de estado', () => {
    expect(parseGiftFilter(undefined)).toBe('activas');
    expect(parseGiftFilter('anuladas')).toBe('anuladas');
    expect(parseGiftFilter('todas')).toBe('todas');
    expect(parseGiftFilter('x')).toBe('activas');
    expect(filterGiftCards(cards, { filter: 'activas' }, nameOf).map((c) => c.id)).toEqual(['a', 'b', 'd']);
    expect(filterGiftCards(cards, { filter: 'anuladas' }, nameOf).map((c) => c.id)).toEqual(['c']);
    expect(filterGiftCards(cards, { filter: 'todas' }, nameOf)).toHaveLength(4);
  });

  it('busca por código o cliente', () => {
    expect(filterGiftCards(cards, { filter: 'todas', q: 'jkmn' }, nameOf).map((c) => c.id)).toEqual(['a']);
    expect(filterGiftCards(cards, { filter: 'todas', q: 'abcd-efgh' }, nameOf).map((c) => c.id)).toEqual(['a']);
    expect(filterGiftCards(cards, { filter: 'todas', q: 'jose' }, nameOf).map((c) => c.id)).toEqual(['a']);
    expect(filterGiftCards(cards, { filter: 'todas', q: 'RUIZ' }, nameOf).map((c) => c.id)).toEqual(['b']);
    expect(filterGiftCards(cards, { filter: 'activas', q: 'zzzz' }, nameOf)).toEqual([]);
  });

  it('totales: saldo pendiente solo de activas', () => {
    expect(giftTotals(cards)).toEqual({ activeCount: 3, voidCount: 1, liabilityCents: 4000 });
  });
});
