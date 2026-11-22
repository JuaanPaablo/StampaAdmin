'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo';
import { needsApproval } from '@/lib/domain';
import { parseMoney } from '@/lib/format';
import type { CreateCodeResult } from '@/lib/contracts';
import type { ActionState, CodeFormState } from '@/components/register/types';

const FIELD_ERRORS = {
  ticket: 'Escribe el número del comprobante.',
  seats: 'Indica cuántos cupos necesitas (mínimo 1).',
  pin: 'El PIN debe tener 4 dígitos.'
};

const createSchema = z.object({
  ticket: z.string().trim().min(1, FIELD_ERRORS.ticket).max(40, 'Máximo 40 caracteres.'),
  amount: z.string().trim().max(14).optional(),
  seats: z.coerce.number({ invalid_type_error: FIELD_ERRORS.seats }).int(FIELD_ERRORS.seats).min(1, FIELD_ERRORS.seats).max(50, 'Máximo 50 cupos.'),
  pin: z.string().trim().optional()
});

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

function revalidateAll(codeId?: string) {
  revalidatePath('/panel/caja');
  if (codeId) revalidatePath('/panel/caja/' + codeId);
  revalidatePath('/panel/control');
  revalidatePath('/panel');
}

export async function createCodeAction(_prev: CodeFormState, fd: FormData): Promise<CodeFormState> {
  const ctx = await getContext();
  const parsed = createSchema.safeParse({ ticket: text(fd, 'ticket'), amount: text(fd, 'amount'), seats: text(fd, 'seats'), pin: text(fd, 'pin') });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue.path[0];
    const field = key === 'ticket' || key === 'seats' ? key : undefined;
    return { error: issue.message, field };
  }
  const { ticket, seats } = parsed.data;
  const pin = parsed.data.pin || undefined;

  let amountCents = 0;
  if (ctx.program.requireAmount) {
    amountCents = parseMoney(parsed.data.amount ?? '');
    if (amountCents <= 0) return { error: 'Escribe el monto total, por ejemplo 12,50.', field: 'amount' };
  }
  if (needsApproval(ctx.program, seats)) {
    if (!pin) return { error: 'Más de ' + ctx.program.maxSeatsWithoutApproval + ' cupos necesitan el PIN de un dueño o gerente.', field: 'pin' };
    if (!/^\d{4}$/.test(pin)) return { error: FIELD_ERRORS.pin, field: 'pin' };
  }

  let result: CreateCodeResult;
  try {
    result = await ctx.repo.createStampCode(ctx.business.id, {
      staffId: ctx.staff.id,
      locationId: ctx.staff.locationId,
      ticket,
      amountCents,
      seats,
      approvalPin: needsApproval(ctx.program, seats) ? pin : undefined
    });
  } catch {
    return { error: 'No se pudo generar el código. Intenta de nuevo.' };
  }
  if (!result.ok) return { error: result.error, field: result.field };
  revalidateAll(result.code.id);
  redirect('/panel/caja/' + result.code.id);
}

const idSchema = z.string().min(1).max(80);

export async function cancelCodeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const codeId = idSchema.safeParse(text(fd, 'codeId'));
  if (!codeId.success) return { ok: false, error: 'Falta el código.' };
  try {
    await ctx.repo.cancelStampCode(ctx.business.id, codeId.data, ctx.staff.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo cancelar el código.' };
  }
  revalidateAll(codeId.data);
  return { ok: true, message: 'Código cancelado.' };
}

export async function voidClaimAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner', 'manager'])) return { ok: false, error: 'Solo un dueño o gerente puede anular un sello.' };
  const ids = z.object({ codeId: idSchema, claimId: idSchema }).safeParse({ codeId: text(fd, 'codeId'), claimId: text(fd, 'claimId') });
  if (!ids.success) return { ok: false, error: 'Falta el sello a anular.' };
  try {
    await ctx.repo.voidClaim(ctx.business.id, ids.data.codeId, ids.data.claimId, ctx.staff.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo anular el sello.' };
  }
  revalidateAll(ids.data.codeId);
  return { ok: true, message: 'Sello anulado. El cupo no se devuelve.' };
}

const DEMO_OFF: ActionState = { ok: false, error: 'Las herramientas de demostración están desactivadas.' };
const demoOn = isDemoMode;

export async function simulateScanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!demoOn()) return DEMO_OFF;
  const ctx = await getContext();
  const ids = z.object({ codeId: idSchema, customerId: idSchema }).safeParse({ codeId: text(fd, 'codeId'), customerId: text(fd, 'customerId') });
  if (!ids.success) return { ok: false, error: 'Elige un ' + ctx.template.vocab.customer + ' para simular el escaneo.' };
  const code = await ctx.repo.getStampCode(ctx.business.id, ids.data.codeId);
  if (!code) return { ok: false, error: 'El código no existe.' };
  const r = await ctx.repo.claimStampCode(ctx.business.id, code.code, ids.data.customerId);
  revalidateAll(code.id);
  if (!r.ok) return { ok: false, error: 'Rechazado: ' + r.error };
  return { ok: true, message: r.customer.name + ' reclamó su sello.' + (r.rewardReady ? ' Completó su tarjeta y tiene un ' + ctx.template.vocab.reward + ' listo.' : '') };
}

/** Simula que alguien reenvía el código por WhatsApp: un cliente que ya reclamó, o un tercero si el código ya murió. */
export async function simulateResendAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!demoOn()) return DEMO_OFF;
  const ctx = await getContext();
  const codeId = idSchema.safeParse(text(fd, 'codeId'));
  if (!codeId.success) return { ok: false, error: 'Falta el código.' };
  const code = await ctx.repo.getStampCode(ctx.business.id, codeId.data);
  if (!code) return { ok: false, error: 'El código no existe.' };

  let customerId = code.claims[0]?.customerId;
  if (!customerId) {
    const list = await ctx.repo.listCustomers(ctx.business.id);
    customerId = list[0]?.id;
  }
  if (!customerId) return { ok: false, error: 'No hay ' + ctx.template.vocab.customers + ' para simular.' };

  const r = await ctx.repo.claimStampCode(ctx.business.id, code.code, customerId);
  revalidateAll(code.id);
  if (!r.ok) return { ok: true, message: 'El reenvío fue rechazado: ' + r.error };
  // El código seguía abierto y el cliente no había reclamado: se contó como un reclamo legítimo.
  return { ok: true, message: 'El código seguía abierto y ' + r.customer.name + ' no había reclamado: se contó como un reclamo normal. Vuelve a probar para ver el rechazo.' };
}

export async function redeemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const customerId = idSchema.safeParse(text(fd, 'customerId'));
  if (!customerId.success) return { ok: false, error: 'Falta el ' + ctx.template.vocab.customer + '.' };
  try {
    const m = Number(text(fd, 'milestone'));
    const r = await ctx.repo.redeemReward(ctx.business.id, customerId.data, ctx.staff.id, Number.isInteger(m) && m > 0 ? m : undefined);
    revalidateAll();
    revalidatePath('/panel/clientes');
    return { ok: true, message: 'Canje registrado para ' + r.customerName + (r.rewardTitle ? ': ' + r.rewardTitle : '') + '.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo registrar el canje.' };
  }
}
