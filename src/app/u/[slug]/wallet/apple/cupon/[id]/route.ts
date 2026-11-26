import { NextResponse } from 'next/server';
import { customerUrl } from '@/lib/urls';
import { appleWalletConfig } from '@/lib/wallet/apple/config';
import { buildApplePass, pkpassResponse } from '@/lib/wallet/apple/service';
import { loadCustomerPage } from '../../../../data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Cupón del cliente en Apple Wallet (.pkpass). Solo sus cupones vigentes y sin usar. */
export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const data = await loadCustomerPage(params.slug);
  const cfg = appleWalletConfig();
  const coupon = data?.mine?.offers.find((co) => co.id === params.id);
  if (!data || data.status === 'suspended' || !data.session || !data.mine || !cfg || !coupon) {
    return NextResponse.redirect(data ? customerUrl(data.business.slug) : customerUrl(params.slug), 303);
  }
  try {
    return pkpassResponse(buildApplePass({ kind: 'coupon', card: data.mine, coupon }, cfg));
  } catch (e) {
    console.error('Apple Wallet (cupón):', e instanceof Error ? e.message : e);
    return NextResponse.redirect(customerUrl(data.business.slug), 303);
  }
}
