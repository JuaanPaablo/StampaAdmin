import { z } from 'zod';
import { TEMPLATES } from '@/lib/templates';
import type { BusinessType } from '@/lib/contracts';

/** Esquemas compartidos entre el asistente (cliente) y la acción de servidor. */
const WEAK = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321']);

export const typeSchema = z
  .string({ required_error: 'Elige el tipo de negocio.' })
  .refine((v): v is BusinessType => v in TEMPLATES, 'Elige el tipo de negocio.');

export const detailsSchema = z
  .object({
    name: z.string().trim().min(2, 'Escribe el nombre de tu negocio.').max(60, 'Máximo 60 caracteres.'),
    city: z.string().trim().max(60, 'Máximo 60 caracteres.').optional(),
    ownerName: z.string().trim().min(2, 'Escribe tu nombre.').max(60, 'Máximo 60 caracteres.'),
    pin: z.string().regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 números.'),
    pin2: z.string(),
    consent: z.literal(true, { errorMap: () => ({ message: 'Necesitamos que aceptes para continuar.' }) })
  })
  .superRefine((d, ctx) => {
    if (/^\d{4}$/.test(d.pin) && WEAK.has(d.pin)) ctx.addIssue({ code: 'custom', path: ['pin'], message: 'Ese PIN es muy fácil de adivinar. Elige otro.' });
    if (d.pin !== d.pin2) ctx.addIssue({ code: 'custom', path: ['pin2'], message: 'Los PIN no coinciden.' });
  });

export type Details = z.input<typeof detailsSchema>;

/** Primer mensaje de error por campo. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? '_'); if (!out[k]) out[k] = i.message; }
  return out;
}
