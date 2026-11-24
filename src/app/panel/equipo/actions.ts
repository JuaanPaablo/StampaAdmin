'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { checkStaffChange } from '@/components/team/rules';
import { accessStatus, emailField, resetPinSchema, staffSchema, pinField, type InviteState, type StaffFormState } from '@/components/team/schema';
import { sendAccessEmail } from '@/lib/access-mail';
import { shareWhatsappUrl } from '@/lib/urls';

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
  const emailChanged = d.email !== '' && d.email !== (existing?.email ?? '');
  if (!isNew && existing?.email && d.email === '') errors.email = 'Esta persona ya tiene correo. Puedes cambiarlo, pero no dejarlo vacío. Para quitarle el acceso, desactívala.';
  if (emailChanged) {
    const owner = await ctx.repo.findStaffByEmail(d.email);
    if (owner && owner.id !== existing?.id) errors.email = 'Ese correo ya tiene acceso a Stampa.';
  }

  if (isNew) {
    const p = pinField.safeParse(d.pin);
    if (!p.success) errors.pin = d.pin === '' ? 'Define un PIN de 4 dígitos.' : p.error.issues[0].message;
    else if (d.pin !== d.pinConfirm) errors.pinConfirm = 'Los dos PIN no coinciden.';
  }
  if (Object.keys(errors).length) return { ok: false, message: 'Revisa los campos marcados.', errors };

  const active = d.active === '1';
  const rule = checkStaffChange({ actor: ctx.staff, target: existing, next: { role: d.role, active }, staff: staffList });
  if (rule) return { ok: false, message: rule };

  let savedId: string;
  try {
    const saved = await ctx.repo.upsertStaff(ctx.business.id, {
      id: existing?.id,
      name: d.name,
      role: d.role,
      active,
      locationId: d.locationId || undefined
    }, isNew ? d.pin : undefined, ctx.staff.id);
    savedId = saved.id;
  } catch {
    return { ok: false, message: 'No pudimos guardar. Intenta de nuevo en un momento.' };
  }
  let emailError: string | undefined;
  if (emailChanged) {
    try {
      await ctx.repo.setStaffEmail(ctx.business.id, savedId, d.email, ctx.staff.id);
    } catch (e) {
      emailError = e instanceof Error && /correo/i.test(e.message) ? e.message : 'No pudimos guardar el correo.';
    }
  }
  revalidatePath('/panel/equipo');
  revalidatePath(`/panel/equipo/${savedId}`);
  if (isNew) redirect(`/panel/equipo/${savedId}?ok=${emailError ? 'creado-sin-correo' : 'creado'}`);
  if (emailError) return { ok: false, message: 'Guardamos los datos, pero no el correo.', errors: { email: emailError } };
  const statusNote = existing?.active && !active
    ? `${d.name} quedó desactivada. Para reactivarla, vuelve a encender "Activo".`
    : !existing?.active && active ? `${d.name} está activa otra vez.` : '';
  return {
    ok: true,
    message: emailChanged ? 'Cambios guardados. Envíale la invitación a su correo nuevo.' : statusNote || 'Cambios guardados.',
    at: Date.now()
  };
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
  return { ok: true, message: `PIN restablecido. ${target.name} ya puede usar el PIN nuevo para aprobaciones.`, at: Date.now() };
}

/**
 * Envía (o reenvía) la invitación para que alguien del equipo cree su contraseña. Solo dueño.
 * FormData: id, email. Si el correo cambió, lo guarda primero. Devuelve el enlace para copiarlo o mandarlo por WhatsApp:
 * el token en claro solo existe en esta respuesta.
 */
export async function sendInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner'])) return { ok: false, error: 'Solo el dueño puede invitar a su equipo.' };
  const id = String(formData.get('id') ?? '');
  const parsedEmail = emailField.safeParse(String(formData.get('email') ?? ''));
  if (!parsedEmail.success) return { ok: false, error: parsedEmail.error.issues[0].message };
  const email = parsedEmail.data;
  if (!email) return { ok: false, error: 'Escribe su correo para enviarle la invitación.' };

  const staffList = await ctx.repo.listStaff(ctx.business.id);
  const target = staffList.find((s) => s.id === id);
  if (!target) return { ok: false, error: 'No encontramos a esa persona.' };
  if (!target.active) return { ok: false, error: 'Esta persona está desactivada. Actívala antes de invitarla.' };
  const changed = email !== (target.email ?? '');
  // Quien ya entra con su correo no necesita invitación (si olvidó su contraseña, la cambia desde la pantalla de ingreso).
  if (!changed && accessStatus(target) === 'active') return { ok: false, error: `${target.name} ya entra con su correo. Si olvidó su contraseña, puede pedir una nueva al ingresar.` };

  let url: string;
  let sent = false;
  let preview = false;
  try {
    if (changed) await ctx.repo.setStaffEmail(ctx.business.id, target.id, email, ctx.staff.id);
    const token = await ctx.repo.issueAccessToken(target.id, 'invite');
    const res = await sendAccessEmail({ to: email, token, businessName: ctx.business.name, inviterName: ctx.staff.name });
    url = res.url;
    sent = res.result.sent;
    preview = !res.result.sent && res.result.preview;
  } catch (e) {
    const msg = e instanceof Error && /correo|persona/i.test(e.message) ? e.message : 'No pudimos preparar la invitación. Intenta de nuevo.';
    return { ok: false, error: msg };
  }
  revalidatePath('/panel/equipo');
  revalidatePath(`/panel/equipo/${target.id}`);
  const first = target.name.split(' ')[0];
  const shareUrl = shareWhatsappUrl(`Hola ${first}, te invito al panel de ${ctx.business.name} en Stampa. Crea tu contraseña aquí: ${url}`);
  const message = sent
    ? `Listo. Le enviamos la invitación a ${email}. También puedes compartirle el enlace.`
    : preview
      ? 'Modo de prueba: el correo no se envió. Comparte este enlace.'
      : 'No pudimos enviar el correo. Comparte este enlace por WhatsApp.';
  return { ok: true, message, url, shareUrl, at: Date.now() };
}
