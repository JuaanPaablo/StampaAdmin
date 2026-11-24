import { NextResponse } from 'next/server';
import { customerUrl } from '@/lib/urls';
import { googleSaveUrl, googleWalletButtonVisible, googleWalletConfig, syncGoogleWallet } from '@/lib/wallet/google';
import { loadCustomerPage } from '../../data';

export const dynamic = 'force-dynamic';

/** "Agregar a Google Wallet": solo para el cliente con sesión y tarjeta en este negocio (su propio pase). */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await loadCustomerPage(params.slug);
  const config = googleWalletConfig();
  if (!data || !data.session || !data.mine || !config || !googleWalletButtonVisible()) {
    return NextResponse.redirect(data ? customerUrl(data.business.slug) : customerUrl(params.slug), 303);
  }
  // Si ya lo había guardado antes, el enlace no actualiza el objeto existente: se actualiza primero.
  await syncGoogleWallet(data.mine);
  const res = NextResponse.redirect(googleSaveUrl(data.mine, config), 303);
  res.headers.set('cache-control', 'no-store');
  return res;
}
