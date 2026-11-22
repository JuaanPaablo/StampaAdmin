'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { TEMPLATES } from '@/lib/templates';
import type { BusinessType } from '@/lib/contracts';
import { validatePlace } from '@/lib/ecuador';

export interface ActionResult { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }

const NO_PERMISSION: ActionResult = { ok: false, error: 'Solo el dueño puede cambiar los ajustes.' };

function errors(err: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? '_'); if (!fieldErrors[k]) fieldErrors[k] = i.message; }
  return { ok: false, fieldErrors };
}

const validTz = (tz: string) => { try { new Intl.DateTimeFormat('es-EC', { timeZone: tz }); return true; } catch { return false; } };

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(60, 'Máximo 60 caracteres.'),
  province: z.string().trim().max(60).default(''),
  city: z.string().trim().max(60).default(''),
  timezone: z.string().refine(validTz, 'Elige una zona horaria válida.'),
  type: z.string().refine((v): v is BusinessType => v in TEMPLATES, 'Elige un tipo de negocio.')
});

export async function updateBusinessAction(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner'])) return NO_PERMISSION;
  const parsed = businessSchema.safeParse({
    name: String(fd.get('name') ?? ''), province: String(fd.get('province') ?? ''), city: String(fd.get('city') ?? ''),
    timezone: String(fd.get('timezone') ?? ''), type: String(fd.get('type') ?? '')
  });
  if (!parsed.success) return errors(parsed.error);
  const place = validatePlace(parsed.data.province, parsed.data.city);
  if (place.province || place.city) return { ok: false, fieldErrors: place as Record<string, string> };
  try {
    await ctx.repo.updateBusiness(ctx.business.id, {
      name: parsed.data.name, province: parsed.data.province, city: parsed.data.city, timezone: parsed.data.timezone, type: parsed.data.type as BusinessType
    });
  } catch {
    return { ok: false, error: 'No pudimos guardar los cambios. Inténtalo de nuevo.' };
  }
  revalidatePath('/panel', 'layout');
  return { ok: true, message: 'Cambios guardados.' };
}

const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Escribe el nombre de la sucursal.').max(60, 'Máximo 60 caracteres.'),
  address: z.string().trim().max(120, 'Máximo 120 caracteres.').optional()
});

/** Mensajes del repo que se pueden mostrar tal cual (límite del plan, sucursal inexistente). */
const repoMessage = (e: unknown, fallback: string) =>
  e instanceof Error && /plan|sucursal/i.test(e.message) ? e.message : fallback;

/** Crea o edita una sucursal. Crear respeta el límite del plan. También la usa el asistente de bienvenida. */
export async function saveLocationAction(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner'])) return NO_PERMISSION;
  const parsed = locationSchema.safeParse({ id: String(fd.get('id') ?? '') || undefined, name: String(fd.get('name') ?? ''), address: String(fd.get('address') ?? '') });
  if (!parsed.success) return errors(parsed.error);
  try {
    const all = await ctx.repo.listLocations(ctx.business.id);
    const current = parsed.data.id ? all.find((l) => l.id === parsed.data.id) : undefined;
    if (parsed.data.id && !current) return { ok: false, error: 'No encontramos esa sucursal.' };
    if (all.some((l) => l.id !== parsed.data.id && l.name.trim().toLowerCase() === parsed.data.name.toLowerCase())) {
      return { ok: false, fieldErrors: { name: 'Ya tienes una sucursal con ese nombre.' } };
    }
    await ctx.repo.upsertLocation(ctx.business.id, { ...(current ?? {}), id: parsed.data.id, name: parsed.data.name, address: parsed.data.address || undefined, active: true });
  } catch (e) {
    return { ok: false, error: repoMessage(e, 'No pudimos guardar la sucursal. Inténtalo de nuevo.') };
  }
  revalidatePath('/panel/ajustes');
  revalidatePath('/bienvenida');
  return { ok: true, message: parsed.data.id ? 'Sucursal guardada.' : 'Sucursal agregada.' };
}

/** Elimina una sucursal: deja de verse en todas partes; los sellos que ya dio conservan su historial. */
export async function deleteLocationAction(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner'])) return NO_PERMISSION;
  const id = String(fd.get('id') ?? '').slice(0, 64);
  if (!id) return { ok: false, error: 'No encontramos esa sucursal.' };
  try {
    await ctx.repo.deleteLocation(ctx.business.id, id, ctx.staff.id);
  } catch (e) {
    return { ok: false, error: repoMessage(e, 'No pudimos eliminar la sucursal. Inténtalo de nuevo.') };
  }
  revalidatePath('/panel/ajustes');
  revalidatePath('/bienvenida');
  return { ok: true, message: 'Sucursal eliminada.' };
}
