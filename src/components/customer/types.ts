/** Estados de los formularios del cliente (compartidos entre las server actions y los componentes). */

export type FlowField = 'name' | 'birth' | 'email' | 'consent' | 'code';

export interface FlowState {
  step: 'form' | 'code';
  mode: 'alta' | 'ingreso';
  /** Correo al que se envió el código (ya normalizado). */
  email?: string;
  /** Solo en modo de prueba (sin Resend): el código se muestra en pantalla. */
  previewCode?: string;
  error?: string;
  fieldErrors?: Partial<Record<FlowField, string>>;
  notice?: string;
  /** Cambia en cada respuesta para reiniciar campos del cliente. */
  nonce?: number;
}

export interface SimpleState {
  error?: string;
  fieldErrors?: Partial<Record<FlowField, string>>;
}
