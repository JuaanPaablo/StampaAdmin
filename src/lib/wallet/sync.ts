import { getRepo } from '../repo';
import { syncGoogleWallet, googleWalletEnabled } from './google';

/** Tras sumar un sello o canjear un premio: actualiza el pase del cliente en Google Wallet (si está configurado). */
export async function syncWalletPass(businessId: string, customerId: string): Promise<void> {
  if (!googleWalletEnabled()) return;
  try {
    await syncGoogleWallet(await getRepo().getCustomerCard(businessId, customerId));
  } catch (e) {
    console.error('syncWalletPass:', e instanceof Error ? e.message : e);
  }
}
