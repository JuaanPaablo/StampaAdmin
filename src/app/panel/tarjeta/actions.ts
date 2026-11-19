'use server';

import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { parseMoney } from '@/lib/format';
import { programSchema, type ProgramFormState } from '@/components/card/schema';

/** Guarda la tarjeta y las reglas de sellos. Solo dueño y gerente. */
export async function saveProgram(_prev: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const ctx = await getContext();
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
      logoUrl: d.logoUrl,
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
  revalidatePath('/panel/tarjeta');
  revalidatePath('/panel/tarjeta/poster');
  return { ok: true, message: 'Cambios guardados. La tarjeta ya se ve así para tus clientes.', at: Date.now() };
}
