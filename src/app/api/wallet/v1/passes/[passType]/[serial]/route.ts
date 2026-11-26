import { latestPass } from '@/lib/wallet/apple/webservice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Apple Wallet: la versión más reciente de un pase (.pkpass firmado). */
export function GET(req: Request, { params }: { params: { passType: string; serial: string } }) {
  return latestPass(req, params.passType, params.serial);
}
