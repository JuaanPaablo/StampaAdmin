'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import type { FormState } from '@/components/customers/form-state';
import { normalizeWhatsapp } from '@/components/customers/contact';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const newCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre completo.').max(80, 'El nombre es demasiado largo.'),
  contactKind: z.enum(['whatsapp', 'email'], { errorMap: () => ({ message: 'Elige el tipo de contacto.' }) }),
  contact: z.string().trim().min(1, 'Escribe el contacto.').max(120),
  day: z.string().optional(),
  month: z.string().optional(),
  consent: z.string().optional()
});

const NO_PERMISSION: FormState = { ok: false, error: 'Tu rol no puede hacer esto. Pide ayuda a un dueño o gerente.' };

function fail(fieldErrors: Record<string, string>): FormState {
  return { ok: false, error: 'Revisa los campos marcados.', fieldErrors };
}

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!hasRole(await getContext(), ['owner', 'manager'])) return NO_PERMISSION;
  const parsed = newCustomerSchema.safeParse({
    name: formData.get('name') ?? '',
    contactKind: formData.get('contactKind') ?? '',
    contact: formData.get('contact') ?? '',
    day: (formData.get('day') as string) || undefined,
    month: (formData.get('month') as string) || undefined,
    consent: (formData.get('consent') as string) || undefined
  });
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return fail(errors);
  }
  const v = parsed.data;

  let contact = v.contact;
  if (v.contactKind === 'email') {
    if (!z.string().email().safeParse(contact).success) errors.contact = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    else contact = contact.toLowerCase();
  } else {
    const digits = normalizeWhatsapp(contact);
    if (!digits) errors.contact = 'Escribe un número de WhatsApp válido, por ejemplo 0991234567.';
    else contact = '+' + digits;
  }

  let birthday: { d: number; m: number } | undefined;
  if (v.day || v.month) {
    const d = Number(v.day), m = Number(v.month);
    if (!v.day || v.month === undefined || !Number.isInteger(d) || !Number.isInteger(m) || m < 0 || m > 11 || d < 1 || d > DAYS_IN_MONTH[m]) {
      errors.birthday = 'Elige un día y un mes que existan, o deja ambos en blanco.';
    } else birthday = { d, m };
  }
  if (v.consent !== 'on') errors.consent = 'Necesitamos la confirmación de que la persona aceptó recibir mensajes.';
  if (Object.keys(errors).length) return fail(errors);

  let id: string;
  try {
    const { repo, business } = await getContext();
    const c = await repo.registerCustomer(business.id, { name: v.name, contact, contactKind: v.contactKind, birthday });
    id = c.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pudimos guardar el registro. Inténtalo de nuevo.' };
  }
  revalidatePath('/panel/clientes');
  revalidatePath('/panel');
  redirect(`/panel/clientes/${id}`);
}

export async function updateNotesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!hasRole(await getContext(), ['owner', 'manager'])) return NO_PERMISSION;
  const parsed = z.object({
    customerId: z.string().min(1),
    notes: z.string().max(1000, 'Máximo 1000 caracteres.')
  }).safeParse({ customerId: formData.get('customerId'), notes: String(formData.get('notes') ?? '') });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: { notes: parsed.error.issues[0].message } };
  try {
    const { repo, business } = await getContext();
    await repo.updateCustomer(business.id, parsed.data.customerId, { notes: parsed.data.notes.trim() });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pudimos guardar las notas.' };
  }
  revalidatePath(`/panel/clientes/${parsed.data.customerId}`);
  return { ok: true, message: 'Notas guardadas.' };
}

export async function redeemRewardAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get('customerId') ?? '');
  if (!customerId) return { ok: false, error: 'Falta el cliente.' };
  try {
    const { repo, business, staff, template } = await getContext();
    const m = Number(formData.get('milestone') ?? '');
    const milestone = Number.isInteger(m) && m > 0 ? m : undefined;
    const r = await repo.redeemReward(business.id, customerId, staff.id, milestone);
    revalidatePath(`/panel/clientes/${customerId}`);
    revalidatePath('/panel/clientes');
    revalidatePath('/panel');
    return { ok: true, message: milestone
      ? `Canje registrado para ${r.customerName}: ${r.rewardTitle ?? template.vocab.reward}. Sigue sumando sellos en la misma tarjeta.`
      : `Canje registrado para ${r.customerName}. La tarjeta volvió a empezar (${template.vocab.reward} entregado).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No se pudo canjear. Revisa que la tarjeta esté completa.' };
  }
}
