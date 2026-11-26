import type { GiftCard, GiftCardMovementKind, GiftCardStatus } from '@/lib/contracts';

/** Textos y filtros de Gift Cards del panel (puros, probados en gift-format.test.ts). */

/** Contenido del QR de una gift card (fijo, ver docs/TARJETAS.md). */
export const giftQrValue = (code: string): string => `STAMPA-GIFT:${code}`;

/** "ABCD EFGH JKMN": el código legible que va debajo del QR (con espacios, como en el pase). */
export const giftCodeSpaced = (code: string): string => (code.match(/.{1,4}/g) ?? [code]).join(' ');

export const MOVEMENT_LABEL: Record<GiftCardMovementKind, string> = {
  issue: 'Venta', topup: 'Recarga', charge: 'Cobro', void: 'Anulación', adjust: 'Ajuste'
};

export type GiftFilter = 'activas' | 'anuladas' | 'todas';

/** Lee el filtro de estado de la URL (por defecto, activas). */
export function parseGiftFilter(v: string | undefined): GiftFilter {
  return v === 'anuladas' || v === 'todas' ? v : 'activas';
}

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Filtra por estado y por búsqueda: código (completo o parte, sin importar guiones, espacios ni mayúsculas) o nombre del
 * cliente (sin importar tildes). `nameOf` da el nombre del cliente de la gift card.
 */
export function filterGiftCards(cards: GiftCard[], opts: { filter: GiftFilter; q?: string }, nameOf: (customerId?: string) => string | undefined): GiftCard[] {
  const wanted: GiftCardStatus | null = opts.filter === 'activas' ? 'active' : opts.filter === 'anuladas' ? 'void' : null;
  const q = fold(opts.q ?? '');
  const qCode = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cards.filter((c) => {
    if (wanted && c.status !== wanted) return false;
    if (!q) return true;
    if (qCode.length >= 3 && c.code.includes(qCode)) return true;
    const name = nameOf(c.customerId);
    return !!name && fold(name).includes(q);
  });
}

export interface GiftTotals {
  activeCount: number;
  voidCount: number;
  /** Saldo pendiente total de las activas: lo que el negocio debe en productos o servicios. */
  liabilityCents: number;
}

export function giftTotals(cards: GiftCard[]): GiftTotals {
  const t: GiftTotals = { activeCount: 0, voidCount: 0, liabilityCents: 0 };
  for (const c of cards) {
    if (c.status === 'active') { t.activeCount++; t.liabilityCents += c.balanceCents; }
    else t.voidCount++;
  }
  return t;
}
