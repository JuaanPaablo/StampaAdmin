'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { checkStaffChange } from '@/components/team/rules';
import { resetPinSchema, staffSchema, pinField, type StaffFormState } from '@/components/team/schema';

function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string') o[k] = v; });
  return o;
}

function zodErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const i of issues) { const k = String(i.path[0] ?? 'form'); if (!errors[k]) errors[k] = i.message; }
  return errors;
}

const NOT_OWNER: StaffFormState = { ok: false, message: 'Solo el dueño puede administrar el equipo.' };

/** Alta y edición de una persona del equipo. Solo dueño. Nunca borra: desactivar es active = false. */
export async function saveStaff(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner'])) return NOT_OWNER;

  const parsed = staffSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Revisa los campos marcados.', errors: zodErrors(parsed.error.issues) };
  const d = parsed.data;
  const isNew = d.id === '';
  const errors: Record<string, string> = {};

  const [staffList, locations] = await Promise.all([ctx.repo.listStaff(ctx.business.id), ctx.repo.listLocations(ctx.business.id)]);
  const existing = isNew ? undefined : staffList.find((s) => s.id === d.id);
  if (!isNew && !existing) return { ok: false, message: 'No encontramos a esa persona. Vuelve a la lista e inténtalo de nuevo.' };
  if (d.locationId && !locations.some((l) => l.id === d.locationId)) errors.locationId = 'Esa sucursal no existe.';

  if (isNew) {
    const p = pinField.safeParse(d.pin);
    if (!p.success) errors.pin = d.pin === '' ? 'Define un PIN de 4 dígitos.' : p.error.issues[0].message;
    else if (d.pin !== d.pinConfirm) errors.pinConfirm = 'Los dos PIN no coinciden.';
  }
  if (Object.keys(errors).length) return { ok: false, message: 'Revisa los campos marcados.', errors };

  const active = d.active === '1';
  const rule = checkStaffChange({ actor: ctx.staff, target: existing, next: { role: d.role, active }, staff: staffList });
  if (rule) return { ok: false, message: rule };

  try {
    await ctx.repo.upsertStaff(ctx.business.id, {
      id: existing?.id,
      name: d.name,
      role: d.role,
      active,
      locationId: d.locationId || undefined
    }, isNew ? d.pin : undefined, ctx.staff.id);
  } catch {
    return { ok: false, message: 'No pudimos guardar. Intenta de nuevo en un momento.' };
  }
  revalidatePath('/panel/equipo');
  if (isNew) redirect('/panel/equipo?ok=creado');
  return { ok: true, message: 'Cambios guardados.', at: Date.now() };
}

/** Restablece el PIN de una persona. Solo dueño. */
export async function resetStaffPin(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner'])) return NOT_OWNER;

  const parsed = resetPinSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Revisa los campos marcados.', errors: zodErrors(parsed.error.issues) };
  const { id, pin } = parsed.data;

  const staffList = await ctx.repo.listStaff(ctx.business.id);
  const target = staffList.find((s) => s.id === id);
  if (!target) return { ok: false, message: 'No encontramos a esa persona.' };
  const rule = checkStaffChange({ actor: ctx.staff, target, next: { role: target.role, active: target.active }, staff: staffList });
  if (rule) return { ok: false, message: rule };

  try {
    await ctx.repo.upsertStaff(ctx.business.id, {
      id: target.id, name: target.name, role: target.role, active: target.active, locationId: target.locationId
    }, pin, ctx.staff.id);
  } catch {
    return { ok: false, message: 'No pudimos restablecer el PIN. Intenta de nuevo.' };
  }
  revalidatePath('/panel/equipo');
  revalidatePath(`/panel/equipo/${id}`);
  return { ok: true, message: `PIN restablecido. ${target.name} ya puede entrar con el PIN nuevo.`, at: Date.now() };
}
