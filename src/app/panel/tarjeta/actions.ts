'use server';

import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { parseMoney } from '@/lib/format';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/mvp-rules';
import { programSchema, type ProgramFormState } from '@/components/card/schema';
import type { ImageActionResult, ImageKind } from '@/components/card/images';

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

  try {
    await ctx.repo.updateProgram(ctx.business.id, {
      name: d.name,
      stampsRequired: d.stampsRequired,
      rewardTitle: d.rewardTitle,
      rewardDescription: d.rewardDescription,
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
    await ctx.repo.updateProgram(ctx.business.id, kind === 'logo' ? { logoUrl: '' } : { coverUrl: '' }, ctx.staff.id);
  } catch {
    return { ok: false, error: 'No pudimos quitar la imagen. Intenta de nuevo.' };
  }
  revalidateCard();
  return { ok: true };
}
