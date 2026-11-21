'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { hasRole } from '@/lib/auth';
import { TEMPLATES } from '@/lib/templates';
import type { BusinessType } from '@/lib/contracts';

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
  city: z.string().trim().max(60, 'Máximo 60 caracteres.').optional(),
  timezone: z.string().refine(validTz, 'Elige una zona horaria válida.'),
  type: z.string().refine((v): v is BusinessType => v in TEMPLATES, 'Elige un tipo de negocio.')
});

export async function updateBusinessAction(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!hasRole(ctx, ['owner'])) return NO_PERMISSION;
  const parsed = businessSchema.safeParse({
    name: String(fd.get('name') ?? ''), city: String(fd.get('city') ?? ''), timezone: String(fd.get('timezone') ?? ''), type: String(fd.get('type') ?? '')
  });
  if (!parsed.success) return errors(parsed.error);
  try {
    await ctx.repo.updateBusiness(ctx.business.id, { name: parsed.data.name, city: parsed.data.city || undefined, timezone: parsed.data.timezone, type: parsed.data.type as BusinessType });
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

/** Crea o edita una sucursal. Si viene el campo "active" ('true' o 'false') también la activa o desactiva. */
export async function saveLocationAction(fd: FormData): Promise<ActionResult> {
  // También la usa el asistente de bienvenida (paso "Tus sucursales"): el dueño de un negocio en configuración pasa.
  const ctx = await getContext({ allowSetup: true });
  if (!hasRole(ctx, ['owner'])) return NO_PERMISSION;
  const parsed = locationSchema.safeParse({ id: String(fd.get('id') ?? '') || undefined, name: String(fd.get('name') ?? ''), address: String(fd.get('address') ?? '') });
  if (!parsed.success) return errors(parsed.error);
  const activeRaw = fd.get('active');
  try {
    const all = await ctx.repo.listLocations(ctx.business.id);
    const current = parsed.data.id ? all.find((l) => l.id === parsed.data.id) : undefined;
    if (parsed.data.id && !current) return { ok: false, error: 'No encontramos esa sucursal.' };
    const active = activeRaw === null ? current?.active ?? true : activeRaw === 'true';
    if (current && current.active && !active && all.filter((l) => l.active).length <= 1) {
      return { ok: false, error: 'Debe quedar al menos una sucursal activa.' };
    }
    if (all.some((l) => l.id !== parsed.data.id && l.name.trim().toLowerCase() === parsed.data.name.toLowerCase())) {
      return { ok: false, fieldErrors: { name: 'Ya tienes una sucursal con ese nombre.' } };
    }
    await ctx.repo.upsertLocation(ctx.business.id, { ...(current ?? {}), id: parsed.data.id, name: parsed.data.name, address: parsed.data.address || undefined, active });
  } catch {
    return { ok: false, error: 'No pudimos guardar la sucursal. Inténtalo de nuevo.' };
  }
  revalidatePath('/panel/ajustes');
  revalidatePath('/bienvenida');
  return { ok: true, message: activeRaw === null ? (parsed.data.id ? 'Sucursal guardada.' : 'Sucursal agregada.') : 'Listo.' };
}
