/** Estados de formularios de la caja (los comparten acciones y componentes cliente). */
export type CodeFormField = 'ticket' | 'amount' | 'seats' | 'pin';

export interface CodeFormState {
  error?: string;
  field?: CodeFormField;
}

export interface ActionState {
  ok: boolean;
  /** Mensaje de éxito o informativo. */
  message?: string;
  /** Mensaje de rechazo. */
  error?: string;
}

export const initialActionState: ActionState = { ok: false };
