import { z } from 'zod';

/** Esquema y tipos del formulario de tarjeta. No lleva 'use server' para poder exportar valores. */

export const TTL_OPTIONS = [180, 300, 600, 900] as const;           // 3, 5, 10, 15 min
export const COOLDOWN_OPTIONS = [0, 60, 240, 1440] as const;        // sin límite, 1 h, 4 h, 24 h

export interface ProgramFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  at?: number;
}

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color con formato #RRGGBB.');
const optText = (max: number, msg: string) => z.string().trim().max(max, msg).default('');

export const programSchema = z.object({
  name: z.string().trim().min(2, 'Escribe al menos 2 letras.').max(40, 'Máximo 40 caracteres.'),
  stampsRequired: z.coerce.number({ invalid_type_error: 'Indica un número.' }).int('Debe ser un número entero.').min(4, 'Mínimo 4 sellos.').max(20, 'Máximo 20 sellos.'),
  rewardTitle: z.string().trim().min(2, 'Escribe el premio.').max(50, 'Máximo 50 caracteres.'),
  rewardDescription: optText(120, 'Máximo 120 caracteres.'),
  bg: hex, accent: hex, ink: hex,
  logoText: z.string().trim().min(1, 'Escribe de 1 a 3 letras.').max(3, 'Máximo 3 letras.'),
  logoUrl: z.string().trim().max(500, 'La dirección es muy larga.').default('')
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Usa una dirección que empiece con https://'),
  birthdayReward: optText(80, 'Máximo 80 caracteres.'),
  rewardExpiresDays: z.string().trim().default('')
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 730), 'Indica de 1 a 730 días o déjalo vacío.'),
  terms: optText(600, 'Máximo 600 caracteres.'),
  requireAmount: z.enum(['1', '0']),
  minSpend: z.string().trim().default(''),
  codeTtlSeconds: z.coerce.number().refine((v) => (TTL_OPTIONS as readonly number[]).includes(v), 'Elige 3, 5, 10 o 15 minutos.'),
  maxSeatsWithoutApproval: z.coerce.number().int().min(1, 'Mínimo 1 cupo.').max(10, 'Máximo 10 cupos.'),
  cooldownMinutes: z.coerce.number().refine((v) => (COOLDOWN_OPTIONS as readonly number[]).includes(v), 'Elige una de las opciones.')
});
export type ProgramInput = z.infer<typeof programSchema>;
