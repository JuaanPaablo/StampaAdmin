'use server';

import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { markRegistered, setSession } from '@/lib/auth';
import { detailsSchema, fieldErrors, typeSchema } from './schema';

export type RegisterResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function createBusinessAction(input: { type: string; details: unknown }): Promise<RegisterResult> {
  const type = typeSchema.safeParse(input?.type);
  if (!type.success) return { ok: false, fieldErrors: { type: type.error.issues[0].message } };
  const details = detailsSchema.safeParse(input.details);
  if (!details.success) return { ok: false, fieldErrors: fieldErrors(details.error) };
  const d = details.data;
  try {
    const { business, ownerId } = await getRepo().createBusiness({
      name: d.name, type: type.data as z.infer<typeof typeSchema>, city: d.city || undefined, ownerName: d.ownerName, ownerPin: d.pin
    });
    markRegistered(business.id);
    await setSession(business.id, ownerId);
    return { ok: true, redirectTo: '/panel?bienvenida=1' };
  } catch {
    return { ok: false, error: 'No pudimos crear tu negocio en este momento. Inténtalo de nuevo en unos minutos.' };
  }
}
