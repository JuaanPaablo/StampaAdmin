import { deviceLog } from '@/lib/wallet/apple/webservice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Apple Wallet: errores que reporta el iPhone. */
export function POST(req: Request) {
  return deviceLog(req);
}
