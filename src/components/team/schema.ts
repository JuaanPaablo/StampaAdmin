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

export const staffSchema = z.object({
  id: z.string().trim().default(''),
  name: z.string().trim().min(2, 'Escribe al menos 2 letras.').max(60, 'Máximo 60 caracteres.'),
  role: z.enum(['owner', 'manager', 'cashier'], { errorMap: () => ({ message: 'Elige un rol.' }) }),
  locationId: z.string().trim().default(''),
  active: z.enum(['1', '0']).default('1'),
  pin: z.string().trim().default(''),
  pinConfirm: z.string().trim().default('')
});

export const resetPinSchema = z.object({
  id: z.string().trim().min(1),
  pin: pinField,
  pinConfirm: z.string().trim()
}).refine((d) => d.pin === d.pinConfirm, { path: ['pinConfirm'], message: 'Los dos PIN no coinciden.' });
