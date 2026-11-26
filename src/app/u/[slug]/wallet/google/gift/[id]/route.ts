import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';
import { customerUrl } from '@/lib/urls';
import { brandFromCard, googleWalletButtonVisible, googleWalletConfig } from '@/lib/wallet/google';
import { googleGiftCardSaveUrl, syncGoogleGiftCardObject } from '@/lib/wallet/google-giftcard';
import { loadCustomerPage } from '../../../../data';

export const dynamic = 'force-dynamic';

/** "Agregar a Google Wallet" de una gift card: solo el cliente con sesión, su propia gift card activa de este negocio. */
export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const data = await loadCustomerPage(params.slug);
  const back = NextResponse.redirect(data ? customerUrl(data.business.slug) : customerUrl(params.slug), 303);
  const config = googleWalletConfig();
  if (!data || data.status === 'suspended' || !data.session || !data.mine || !config || !googleWalletButtonVisible() || !/^[\w-]{1,64}$/.test(params.id)) return back;
  const g = await getRepo().getGiftCard(data.business.id, params.id).catch(() => null);
  if (!g || g.businessId !== data.business.id || g.customerId !== data.mine.customer.id || g.status !== 'active') return back;
  const brand = brandFromCard(data.mine);
  // Si ya la había guardado, el enlace no actualiza el objeto existente: se actualiza primero.
  await syncGoogleGiftCardObject(brand, g);
  const res = NextResponse.redirect(googleGiftCardSaveUrl(brand, g, config), 303);
  res.headers.set('cache-control', 'no-store');
  return res;
}
