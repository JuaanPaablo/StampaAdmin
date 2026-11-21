import { cache } from 'react';
import type { Metadata } from 'next';
import { readCustomerSession, readPendingSignup } from '@/lib/customer-session';
import { businessStatus, PLACEHOLDER_BUSINESS_NAME } from '@/lib/mvp-rules';
import { getRepo } from '@/lib/repo';

/** Carga común de /u/<slug> y /u/<slug>/sello. Solo datos del negocio y del cliente con sesión (nunca de otros clientes). */
export const loadCustomerPage = cache(async (slug: string) => {
  const repo = getRepo();
  const business = /^[a-z0-9-]{1,80}$/.test(slug) ? await repo.getBusinessBySlug(slug) : null;
  if (!business) return null;
  const status = businessStatus(business);
  const program = await repo.getProgram(business.id);
  const session = await readCustomerSession();
  const cards = session ? await repo.listCustomerCards(session.email) : [];
  const mine = cards.find((c) => c.business.id === business.id) ?? null;
  const pending = session ? null : await readPendingSignup();
  return { business, status, program, session, cards, mine, pending: pending && pending.slug === business.slug ? pending : null };
});

export async function customerMetadata(slug: string): Promise<Metadata> {
  const data = await loadCustomerPage(slug);
  const name = data && data.business.name !== PLACEHOLDER_BUSINESS_NAME ? data.business.name : null;
  return { title: name ? `Tarjeta de ${name} · Stampa` : 'Tarjeta de sellos · Stampa' };
}
