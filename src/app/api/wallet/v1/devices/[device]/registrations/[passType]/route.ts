import { serialsForDevice } from '@/lib/wallet/apple/webservice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Apple Wallet: seriales de los pases del iPhone que cambiaron desde passesUpdatedSince. */
export function GET(req: Request, { params }: { params: { device: string; passType: string } }) {
  return serialsForDevice(req, params.device, params.passType);
}
