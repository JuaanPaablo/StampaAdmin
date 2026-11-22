'use server';

import { features } from '@/lib/plans';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSetupContext } from '@/lib/context';
import { parseMoney } from '@/lib/format';
import { TEMPLATES } from '@/lib/templates';
import { validatePlace } from '@/lib/ecuador';
import type { BusinessType } from '@/lib/contracts';
import { parseMilestonesField, programSchema, type ProgramFormState } from '@/components/card/schema';
import { clearProgress, markStepDone } from './progress';

/**
 * Acciones del asistente de bienvenida. Todas exigen al DUEÑO de un negocio en 'setup' (getSetupContext). Si no lo es
 * (sesión vencida, otro rol, negocio ya activo), vuelven a /bienvenida, que decide a dónde mandar a cada quien.
 * Cada paso guarda y lleva al siguiente con ?paso=N; así recargar retoma el mismo paso.
 */

export interface StepState { ok: boolean; message?: string; errors?: Record<string, string> }

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? 'form'); if (!out[k]) out[k] = i.message; }
  return out;
}

async function setupOrBack() {
  const ctx = await getSetupContext();
  if (!ctx) redirect('/bienvenida');
  return ctx;
}

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de tu negocio.').max(80, 'Máximo 80 letras.'),
  type: z.string().refine((v): v is BusinessType => v in TEMPLATES, 'Elige el tipo de tu negocio.'),
  province: z.string().trim().max(60).default(''),
  city: z.string().trim().max(60).default('')
});

/** Paso 1: nombre, tipo y ciudad. */
export async function saveBusinessStep(_prev: StepState, fd: FormData): Promise<StepState> {
  const ctx = await setupOrBack();
  const parsed = businessSchema.safeParse({ name: fd.get('name') ?? '', type: fd.get('type') ?? '', province: fd.get('province') ?? '', city: fd.get('city') ?? '' });
  const placeErr = validatePlace(parsed.success ? parsed.data.province : undefined, parsed.success ? parsed.data.city : undefined);
  if (!parsed.success || placeErr.province || placeErr.city) {
    return { ok: false, message: 'Revisa los campos marcados.', errors: { ...(parsed.success ? {} : zodErrors(parsed.error)), ...placeErr } };
  }
  try {
    await ctx.repo.saveBusinessSetup(ctx.business.id, { name: parsed.data.name, type: parsed.data.type as BusinessType, province: parsed.data.province, city: parsed.data.city }, ctx.staff.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    // Los errores de validación del repo vienen en español y hablan del nombre.
    if (/nombre/i.test(msg)) return { ok: false, message: 'Revisa los campos marcados.', errors: { name: msg } };
    return { ok: false, message: 'No pudimos guardar. Intenta de nuevo en un momento.' };
  }
  await markStepDone(ctx.business.id, 1);
  revalidatePath('/bienvenida');
  redirect('/bienvenida?paso=2');
}

const colorsSchema = programSchema.pick({ bg: true, accent: true, ink: true });

/** Paso 2: colores de la tarjeta (el logo y la portada se suben aparte, con uploadImageAction). */
export async function saveColorsStep(_prev: ProgramFormState, fd: FormData): Promise<ProgramFormState> {
  const ctx = await setupOrBack();
  const parsed = colorsSchema.safeParse({ bg: fd.get('bg'), accent: fd.get('accent'), ink: fd.get('ink') });
  if (!parsed.success) return { ok: false, message: 'Revisa los colores marcados.', errors: zodErrors(parsed.error) };
  const { bg, accent, ink } = parsed.data;
  try {
    await ctx.repo.updateProgram(ctx.business.id, { colors: { bg: bg.toUpperCase(), accent: accent.toUpperCase(), ink: ink.toUpperCase() } }, ctx.staff.id);
  } catch {
    return { ok: false, message: 'No pudimos guardar los colores. Intenta de nuevo.' };
  }
  await markStepDone(ctx.business.id, 2);
  revalidatePath('/bienvenida');
  redirect('/bienvenida?paso=3');
}

/** "Saltar por ahora" en el paso 2 (imagen y colores son opcionales). */
export async function skipImageStep(): Promise<void> {
  const ctx = await setupOrBack();
  await markStepDone(ctx.business.id, 2);
  redirect('/bienvenida?paso=3');
}

/** Paso 3: seguir solo si hay al menos una sucursal activa (se guardan con saveLocationAction de Ajustes). */
export async function finishLocationsStep(): Promise<void> {
  const ctx = await setupOrBack();
  const locations = await ctx.repo.listLocations(ctx.business.id);
  if (!locations.some((l) => l.active)) redirect('/bienvenida?paso=3');
  await markStepDone(ctx.business.id, 3);
  redirect('/bienvenida?paso=4');
}

const cardSchema = programSchema.pick({ stampsRequired: true, rewardTitle: true, birthdayReward: true, requireAmount: true, minSpend: true });

/** Paso 4: sellos necesarios, premio, monto mínimo por sello y regalo de cumpleaños. */
export async function saveCardStep(_prev: ProgramFormState, fd: FormData): Promise<ProgramFormState> {
  const ctx = await setupOrBack();
  const raw: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string') raw[k] = v; });
  const parsed = cardSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Revisa los campos marcados.', errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const requireAmount = d.requireAmount === '1';
  const minSpend = parseMoney(d.minSpend);
  if (requireAmount && (minSpend < 50 || minSpend > 50000)) {
    return { ok: false, message: 'Revisa los campos marcados.', errors: { minSpend: 'Indica un monto entre $0,50 y $500,00.' } };
  }
  const ms = parseMilestonesField(fd.get('milestones'), d.stampsRequired, features(ctx.business.plan).maxMilestones);
  if ('error' in ms) return { ok: false, message: 'Revisa los campos marcados.', errors: { milestones: ms.error } };
  try {
    await ctx.repo.updateProgram(ctx.business.id, {
      stampsRequired: d.stampsRequired,
      rewardTitle: d.rewardTitle,
      milestones: ms.value,
      birthdayReward: d.birthdayReward,
      requireAmount,
      minSpendCentsPerStamp: requireAmount ? minSpend : ctx.program.minSpendCentsPerStamp
    }, ctx.staff.id);
  } catch {
    return { ok: false, message: 'No pudimos guardar tu tarjeta. Intenta de nuevo.' };
  }
  await markStepDone(ctx.business.id, 4);
  revalidatePath('/bienvenida');
  redirect('/bienvenida?paso=5');
}

/** Paso 5: activa el negocio y abre el panel con el aviso de bienvenida. */
export async function completeSetupAction(_prev: StepState, _fd: FormData): Promise<StepState> {
  const ctx = await setupOrBack();
  try {
    await ctx.repo.completeBusinessSetup(ctx.business.id, ctx.staff.id);
  } catch (e) {
    const msg = e instanceof Error && e.message ? e.message : 'No pudimos activar tu negocio. Intenta de nuevo.';
    return { ok: false, message: msg };
  }
  await clearProgress();
  revalidatePath('/panel', 'layout');
  redirect('/panel?bienvenida=1');
}
