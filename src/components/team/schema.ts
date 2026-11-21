import { z } from 'zod';
import { weakPin } from './rules';

export interface StaffFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  at?: number;
}

export const pinField = z.string().trim()
  .regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 dígitos.')
  .refine((p) => !weakPin(p), 'Ese PIN es muy fácil de adivinar. Evita 1234 o 0000.');

/** Correo de acceso opcional ('' = sin correo). Se guarda en minúsculas. */
export const emailField = z.string().trim().toLowerCase().max(254, 'El correo es demasiado largo.')
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Escribe un correo válido, por ejemplo nombre@correo.com.');

export const staffSchema = z.object({
  id: z.string().trim().default(''),
  name: z.string().trim().min(2, 'Escribe al menos 2 letras.').max(60, 'Máximo 60 caracteres.'),
  role: z.enum(['owner', 'manager', 'cashier'], { errorMap: () => ({ message: 'Elige un rol.' }) }),
  locationId: z.string().trim().default(''),
  email: emailField.default(''),
  active: z.enum(['1', '0']).default('1'),
  pin: z.string().trim().default(''),
  pinConfirm: z.string().trim().default('')
});

/** Estado del acceso al panel de una persona del equipo. */
export type AccessStatus = 'none' | 'pending' | 'active';
export function accessStatus(s: { email?: string; invitePending?: boolean }): AccessStatus {
  if (!s.email) return 'none';
  return s.invitePending ? 'pending' : 'active';
}
export const ACCESS_LABEL: Record<AccessStatus, string> = { none: 'Sin acceso', pending: 'Invitación pendiente', active: 'Con acceso' };
export const ACCESS_TONE: Record<AccessStatus, 'neutral' | 'warn' | 'ok'> = { none: 'neutral', pending: 'warn', active: 'ok' };

export interface InviteState {
  ok: boolean;
  message?: string;
  error?: string;
  /** Enlace de invitación (contiene el token en claro): solo vive en esta respuesta, nunca en la URL. */
  url?: string;
  shareUrl?: string;
  at?: number;
}

export const resetPinSchema = z.object({
  id: z.string().trim().min(1),
  pin: pinField,
  pinConfirm: z.string().trim()
}).refine((d) => d.pin === d.pinConfirm, { path: ['pinConfirm'], message: 'Los dos PIN no coinciden.' });
