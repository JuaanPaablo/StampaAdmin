import { registerDevice, unregisterDevice } from '@/lib/wallet/apple/webservice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type P = { params: { device: string; passType: string; serial: string } };

/** Apple Wallet: un iPhone registra (POST) o da de baja (DELETE) un pase para recibir actualizaciones. */
export function POST(req: Request, { params }: P) {
  return registerDevice(req, params.device, params.passType, params.serial);
}

export function DELETE(req: Request, { params }: P) {
  return unregisterDevice(req, params.device, params.passType, params.serial);
}
