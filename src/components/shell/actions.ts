'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { BIZ_COOKIE, STAFF_COOKIE, signOut } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import { isDemoMode } from '@/lib/demo';

const opts = () => ({ httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 12 });
const demoOn = isDemoMode;

/** Modo demo: cambia de negocio. La persona vuelve a ser el dueño del negocio elegido. */
export async function switchBusinessAction(formData: FormData): Promise<void> {
  if (!demoOn()) return;
  const id = String(formData.get('businessId') ?? '');
  const business = id ? await getRepo().getBusiness(id) : null;
  if (!business) return;
  const jar = await Promise.resolve(cookies());
  jar.set(BIZ_COOKIE, business.id, opts());
  jar.delete(STAFF_COOKIE);
  revalidatePath('/panel', 'layout');
}

/** Modo demo: cambia la persona que opera dentro del negocio activo. */
export async function switchStaffAction(formData: FormData): Promise<void> {
  if (!demoOn()) return;
  const jar = await Promise.resolve(cookies());
  const businessId = jar.get(BIZ_COOKIE)?.value;
  const staffId = String(formData.get('staffId') ?? '');
  if (!businessId || !staffId) return;
  const staff = (await getRepo().listStaff(businessId)).find((s) => s.id === staffId && s.active);
  if (!staff) return;
  jar.set(STAFF_COOKIE, staff.id, opts());
  revalidatePath('/panel', 'layout');
}

export async function signOutAction(): Promise<void> {
  await signOut();
}
