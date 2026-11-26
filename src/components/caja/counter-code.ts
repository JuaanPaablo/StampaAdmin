import { normalizeGiftCardCode } from '@/lib/domain/wallet-cards';

/**
 * Lee lo que Caja escanea o escribe en "Cupón o gift card". Formatos fijos (docs/TARJETAS.md):
 *   - Cupón: `STAMPA-CUPON:<cof id>` (o el id `cof_…` escrito a mano).
 *   - Gift card: `STAMPA-GIFT:<código>` o el código de 12 caracteres con o sin espacios/guiones.
 * Tolera lectores de código de barras configurados en inglés sobre un teclado en español, que cambian
 * ":" por "Ñ", "-" por "'" y "_" por "?". Pura y segura para el navegador.
 */
export type CounterCode =
  | { kind: 'coupon'; id: string }
  | { kind: 'gift'; code: string }
  | { kind: 'invalid'; error: string };

export const COUNTER_CODE_EMPTY = 'Escanea el QR o escribe el código de la gift card.';
export const COUNTER_CODE_UNKNOWN = 'No reconocemos ese código. Escanea el QR del cupón o de la gift card, o escribe los 12 caracteres de la gift card.';
export const COUNTER_COUPON_BAD = 'Ese QR de cupón está incompleto. Pide al cliente que lo vuelva a mostrar.';
export const COUNTER_GIFT_BAD = 'El código de la gift card debe tener 12 caracteres (letras y números, sin O, I, L, 0 ni 1).';

const PREFIX = /^STAMPA\s*[-'_]?\s*(CUP[OÓ]N|GIFT)\s*[:Ññ;]\s*(.*)$/i;
const COUPON_ID = /^cof_[a-z0-9_]{1,60}$/;

function couponId(raw: string): string | null {
  const id = raw.trim().replace(/\?/g, '_').toLowerCase();
  return COUPON_ID.test(id) ? id : null;
}

export function parseCounterCode(input: string | null | undefined): CounterCode {
  const text = String(input ?? '').trim();
  if (!text) return { kind: 'invalid', error: COUNTER_CODE_EMPTY };

  const m = PREFIX.exec(text);
  if (m) {
    const isCoupon = m[1].toUpperCase() !== 'GIFT';
    if (isCoupon) {
      const id = couponId(m[2]);
      return id ? { kind: 'coupon', id } : { kind: 'invalid', error: COUNTER_COUPON_BAD };
    }
    const code = normalizeGiftCardCode(m[2]);
    return code ? { kind: 'gift', code } : { kind: 'invalid', error: COUNTER_GIFT_BAD };
  }

  if (/^cof[_?]/i.test(text)) {
    const id = couponId(text);
    return id ? { kind: 'coupon', id } : { kind: 'invalid', error: COUNTER_COUPON_BAD };
  }

  const code = normalizeGiftCardCode(text);
  if (code) return { kind: 'gift', code };
  return { kind: 'invalid', error: COUNTER_CODE_UNKNOWN };
}
