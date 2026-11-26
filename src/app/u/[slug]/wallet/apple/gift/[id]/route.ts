import { NextResponse } from 'next/server';
import { customerUrl } from '@/lib/urls';
import { appleWalletConfig } from '@/lib/wallet/apple/config';
import { buildApplePass, pkpassResponse } from '@/lib/wallet/apple/service';
import { loadCustomerPage } from '../../../../data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Gift card del cliente en Apple Wallet (.pkpass). Solo sus gift cards activas. */
export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const data = await loadCustomerPage(params.slug);
  const cfg = appleWalletConfig();
  const gift = data?.mine?.giftCards.find((g) => g.id === params.id);
  if (!data || data.status === 'suspended' || !data.session || !data.mine || !cfg || !gift) {
    return NextResponse.redirect(data ? customerUrl(data.business.slug) : customerUrl(params.slug), 303);
  }
  try {
    return pkpassResponse(buildApplePass({ kind: 'gift', card: data.mine, gift }, cfg));
  } catch (e) {
    console.error('Apple Wallet (gift card):', e instanceof Error ? e.message : e);
    return NextResponse.redirect(customerUrl(data.business.slug), 303);
  }
}
