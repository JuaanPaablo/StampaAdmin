'use server';

import { z } from 'zod';
import { signIn } from '@/lib/auth';

export type SignInActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; field?: 'business' | 'staff' | 'pin' };

const schema = z.object({
  businessId: z.string().min(1, 'Elige tu negocio.'),
  staffId: z.string().min(1, 'Elige quién eres.'),
  pin: z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos.')
});

export async function signInAction(input: { businessId: string; staffId: string; pin: string }): Promise<SignInActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0] === 'businessId' ? 'business' : issue.path[0] === 'staffId' ? 'staff' : 'pin';
    return { ok: false, error: issue.message, field };
  }
  const r = await signIn(parsed.data.businessId, parsed.data.staffId, parsed.data.pin);
  return r.ok ? { ok: true, redirectTo: r.redirectTo } : { ok: false, error: r.error, field: r.field };
}
