import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';
import { customerUrl } from '@/lib/urls';
import { customerOfferRedeemError } from '@/lib/domain/wallet-cards';
import { brandFromCard, googleWalletButtonVisible, googleWalletConfig } from '@/lib/wallet/google';
import { googleOfferSaveUrl, syncGoogleOfferObject } from '@/lib/wallet/google-offer';
import { loadCustomerPage } from '../../../../data';

export const dynamic = 'force-dynamic';

/** "Agregar a Google Wallet" de un cupón: solo el cliente con sesión, su propio cupón de este negocio, vigente y sin usar. */
export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const data = await loadCustomerPage(params.slug);
  const back = NextResponse.redirect(data ? customerUrl(data.business.slug) : customerUrl(params.slug), 303);
  const config = googleWalletConfig();
  if (!data || data.status === 'suspended' || !data.session || !data.mine || !config || !googleWalletButtonVisible() || !/^[\w-]{1,64}$/.test(params.id)) return back;
  const co = await getRepo().findCustomerOffer(data.business.id, params.id).catch(() => null);
  if (!co || co.businessId !== data.business.id || co.customerId !== data.mine.customer.id || customerOfferRedeemError(co, co.offer)) return back;
  const brand = brandFromCard(data.mine);
  // Si ya lo había guardado, el enlace no actualiza el objeto existente: se actualiza primero.
  await syncGoogleOfferObject(brand, co);
  const res = NextResponse.redirect(googleOfferSaveUrl(brand, co, config), 303);
  res.headers.set('cache-control', 'no-store');
  return res;
}
