import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';
import { customerUrl } from '@/lib/urls';
import { appleWalletConfig } from '@/lib/wallet/apple/config';
import { buildApplePass, pkpassResponse } from '@/lib/wallet/apple/service';
import { sameSiteNavigation } from '@/lib/wallet/fetch-site';
import { loadCustomerPage } from '../../data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** "Agregar a Apple Wallet" (tarjeta de sellos): .pkpass firmado, solo para el cliente con sesión y tarjeta aquí. */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const data = await loadCustomerPage(params.slug);
  const cfg = appleWalletConfig();
  if (!data || !data.session || !data.mine || !cfg) {
    return NextResponse.redirect(data ? customerUrl(data.business.slug) : customerUrl(params.slug), 303);
  }
  let pass;
  try {
    pass = buildApplePass({ kind: 'stamp', card: data.mine }, cfg);
  } catch (e) {
    console.error('Apple Wallet (sellos):', e instanceof Error ? e.message : e);
    return NextResponse.redirect(customerUrl(data.business.slug), 303);
  }
  // Para la ficha del cliente ("Tarjeta en el celular"). Best effort: no impide la descarga.
  // Solo si la navegación no viene de otro sitio (un GET ajeno no debe cambiar la ficha).
  if (data.mine.customer.wallet !== 'apple' && sameSiteNavigation(req)) {
    try { await getRepo().setCustomerWallet(data.business.id, data.mine.customer.id, 'apple'); }
    catch (e) { console.error('setCustomerWallet:', e instanceof Error ? e.message : e); }
  }
  return pkpassResponse(pass);
}
