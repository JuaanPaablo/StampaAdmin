import type { GiftCardMovementKind, GiftCardStatus } from '@/lib/contracts';

/** Lo que Caja ve de un cupón escaneado (fechas ya formateadas en hora de Ecuador). */
export interface CouponView {
  kind: 'coupon';
  id: string;
  customerName: string;
  title: string;
  description: string;
  terms?: string;
  validity: string;
  /** "Vigente", "Ya usado", "Vencido"… */
  statusLabel: string;
  /** Por qué no se puede canjear (null = se puede). */
  problem: string | null;
  redeemedAt?: string;
}

export interface GiftMovementView {
  id: string;
  kind: GiftCardMovementKind;
  amountCents: number;
  balanceAfterCents: number;
  at: string;
  note?: string;
}

/** Lo que Caja ve de una gift card (el código completo solo se muestra enmascarado). */
export interface GiftView {
  kind: 'gift';
  id: string;
  maskedCode: string;
  customerName?: string;
  balanceCents: number;
  status: GiftCardStatus;
  movements: GiftMovementView[];
}

export type CounterField = 'code' | 'charge' | 'topup';

export interface CounterState {
  item?: CouponView | GiftView;
  error?: string;
  field?: CounterField;
  /** Éxito de la última operación (canje, cobro o recarga). */
  message?: string;
  /** Cambia en cada respuesta: el cliente lo usa para limpiar campos y mover el foco. */
  seq: number;
}

export const initialCounterState: CounterState = { seq: 0 };
