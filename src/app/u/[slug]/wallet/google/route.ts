import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';
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
  // Para la ficha del cliente ("Tarjeta en el celular"). Se marca al tocar el botón: Google no avisa si al final la
  // guardó. Un fallo aquí no debe impedir que la agregue.
  if (data.mine.customer.wallet !== 'google') {
    try { await getRepo().setCustomerWallet(data.business.id, data.mine.customer.id, 'google'); }
    catch (e) { console.error('setCustomerWallet:', e instanceof Error ? e.message : e); }
  }
  const res = NextResponse.redirect(googleSaveUrl(data.mine, config), 303);
  res.headers.set('cache-control', 'no-store');
  return res;
}
