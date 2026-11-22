'use server';

import { features } from '@/lib/plans';
import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { parseMoney } from '@/lib/format';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/mvp-rules';
import { parseMilestonesField, programSchema, type ProgramFormState } from '@/components/card/schema';
import type { ImageActionResult, ImageKind } from '@/components/card/images';
import { cleanFraming } from '@/lib/rewards';
import { z } from 'zod';
import type { PosterStyle } from '@/lib/contracts';

function revalidateCard(): void {
  revalidatePath('/panel/tarjeta');
  revalidatePath('/panel/tarjeta/poster');
  revalidatePath('/bienvenida');
}

/** Guarda la tarjeta y las reglas de sellos. Solo dueño y gerente (el dueño también durante el asistente). */
export async function saveProgram(_prev: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner', 'manager'])) return { ok: false, message: 'Solo el dueño o un gerente puede cambiar la tarjeta.' };

  const raw: Record<string, FormDataEntryValue> = {};
  formData.forEach((v, k) => { if (typeof v === 'string') raw[k] = v; });
  const parsed = programSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: 'Revisa los campos marcados. No se guardó nada.', errors };
  }
  const d = parsed.data;
  const requireAmount = d.requireAmount === '1';
  const minSpend = parseMoney(d.minSpend);
  if (requireAmount && (minSpend < 50 || minSpend > 50000)) {
    return { ok: false, message: 'Revisa los campos marcados. No se guardó nada.', errors: { minSpend: 'Indica un monto entre $0,50 y $500,00.' } };
  }
  const ms = parseMilestonesField(formData.get('milestones'), d.stampsRequired, features(ctx.business.plan).maxMilestones);
  if ('error' in ms) return { ok: false, message: 'Revisa los campos marcados. No se guardó nada.', errors: { milestones: ms.error } };

  try {
    await ctx.repo.updateProgram(ctx.business.id, {
      name: d.name,
      stampsRequired: d.stampsRequired,
      rewardTitle: d.rewardTitle,
      rewardDescription: d.rewardDescription,
      milestones: ms.value,
      colors: { bg: d.bg.toUpperCase(), accent: d.accent.toUpperCase(), ink: d.ink.toUpperCase() },
      logoText: d.logoText.toUpperCase(),
      birthdayReward: d.birthdayReward,
      rewardExpiresDays: d.rewardExpiresDays === '' ? undefined : Number(d.rewardExpiresDays),
      terms: d.terms,
      requireAmount,
      // Si el monto no aplica se conserva el último mínimo guardado.
      minSpendCentsPerStamp: requireAmount ? minSpend : ctx.program.minSpendCentsPerStamp,
      codeTtlSeconds: d.codeTtlSeconds,
      maxSeatsWithoutApproval: d.maxSeatsWithoutApproval,
      cooldownMinutes: d.cooldownMinutes
    }, ctx.staff.id);
  } catch {
    return { ok: false, message: 'No pudimos guardar los cambios. Intenta de nuevo en un momento.' };
  }
  revalidateCard();
  return { ok: true, message: 'Cambios guardados. Tus clientes ya ven la tarjeta así.', at: Date.now() };
}

const KINDS: ImageKind[] = ['logo', 'cover'];
const NO_PERMISSION: ImageActionResult = { ok: false, error: 'Solo el dueño o un gerente puede cambiar las imágenes.' };

/**
 * Sube el logo o la portada (FormData: kind = 'logo' | 'cover', file). Valida tipo y tamaño aquí y el repo vuelve a
 * validar la firma real del archivo. Devuelve la URL pública.
 */
export async function uploadImageAction(fd: FormData): Promise<ImageActionResult> {
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner', 'manager'])) return NO_PERMISSION;
  const kind = fd.get('kind');
  const file = fd.get('file');
  if (typeof kind !== 'string' || !(KINDS as string[]).includes(kind)) return { ok: false, error: 'No sabemos qué imagen quieres cambiar.' };
  if (!file || typeof file === 'string') return { ok: false, error: 'Elige una imagen.' };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: 'La imagen debe ser PNG, JPG o WEBP.' };
  if (file.size === 0) return { ok: false, error: 'Elige una imagen.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'La imagen pesa más de 2 MB. Usa una más liviana.' };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await ctx.repo.uploadBusinessImage(ctx.business.id, kind as ImageKind, { bytes, contentType: file.type });
    // Imagen nueva: vuelve al encuadre centrado.
    const { [kind as ImageKind]: _old, ...rest } = ctx.program.imageFraming ?? {};
    await ctx.repo.updateProgram(ctx.business.id, { imageFraming: rest }, ctx.staff.id);
    revalidateCard();
    return { ok: true, url };
  } catch (e) {
    // Los errores de validación del repo vienen en español y son seguros de mostrar.
    const msg = e instanceof Error && /imagen|PNG|MB/i.test(e.message) ? e.message : 'No pudimos subir la imagen. Intenta de nuevo.';
    return { ok: false, error: msg };
  }
}

/** Quita el logo (vuelven las iniciales) o la portada. */
export async function removeImageAction(fd: FormData): Promise<ImageActionResult> {
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner', 'manager'])) return NO_PERMISSION;
  const kind = fd.get('kind');
  if (typeof kind !== 'string' || !(KINDS as string[]).includes(kind)) return { ok: false, error: 'No sabemos qué imagen quieres quitar.' };
  try {
    const { [kind as ImageKind]: _old, ...rest } = ctx.program.imageFraming ?? {};
    await ctx.repo.updateProgram(ctx.business.id, kind === 'logo' ? { logoUrl: '', imageFraming: rest } : { coverUrl: '', imageFraming: rest }, ctx.staff.id);
  } catch {
    return { ok: false, error: 'No pudimos quitar la imagen. Intenta de nuevo.' };
  }
  revalidateCard();
  return { ok: true };
}

/** Guarda el encuadre (posición y zoom) del logo o la portada. FormData: kind, x, y, zoom. */
export async function saveFramingAction(fd: FormData): Promise<ImageActionResult> {
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner', 'manager'])) return NO_PERMISSION;
  const kind = fd.get('kind');
  if (typeof kind !== 'string' || !(KINDS as string[]).includes(kind)) return { ok: false, error: 'No sabemos qué imagen quieres ajustar.' };
  const framing = cleanFraming({ x: Number(fd.get('x')), y: Number(fd.get('y')), zoom: Number(fd.get('zoom')) });
  try {
    const current = ctx.program.imageFraming ?? {};
    await ctx.repo.updateProgram(ctx.business.id, { imageFraming: { ...current, [kind]: framing } }, ctx.staff.id);
  } catch {
    return { ok: false, error: 'No pudimos guardar el encuadre. Intenta de nuevo.' };
  }
  revalidateCard();
  return { ok: true };
}

const THEMES = ['stampa', 'tarjeta', 'claro', 'sol', 'personal'] as const;
const FONTS = ['sora', 'redonda', 'clasica', 'impacto', 'manuscrita'] as const;
const posterSchema = z.object({
  theme: z.enum(THEMES),
  font: z.enum(FONTS),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  title: z.string().trim().max(40, 'El título puede tener hasta 40 letras.').default(''),
  showReward: z.boolean().default(true)
});

/** Guarda el diseño del póster con QR (tema, letra, colores propios, título). */
export async function savePosterAction(design: unknown): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner', 'manager'])) return { ok: false, error: 'Solo el dueño o un gerente puede cambiar el póster.' };
  if (!features(ctx.business.plan).posterDesign) return { ok: false, error: 'Diseñar el póster está disponible desde el plan Standard.' };
  const parsed = posterSchema.safeParse(design);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisa el diseño.' };
  const d = parsed.data;
  const poster: PosterStyle = { theme: d.theme, font: d.font, title: d.title, showReward: d.showReward };
  if (d.theme === 'personal') Object.assign(poster, { bg: d.bg?.toUpperCase(), accent: d.accent?.toUpperCase(), ink: d.ink?.toUpperCase() });
  try {
    await ctx.repo.updateProgram(ctx.business.id, { poster }, ctx.staff.id);
  } catch {
    return { ok: false, error: 'No pudimos guardar el diseño. Intenta de nuevo.' };
  }
  revalidatePath('/panel/tarjeta/poster');
  return { ok: true };
}
