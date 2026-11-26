import { getRepo } from '../repo';
import { canNotify, notifyWindowStartIso, WALLET_NOTIFY_MAX } from '../domain/wallet-cards';
import { brandFromCard, googleBrand, googleWalletEnabled, syncGoogleWallet, type GoogleBrand } from './google';
import { syncGoogleOfferObject } from './google-offer';
import { syncGoogleGiftCardObject } from './google-giftcard';
import { appleWalletEnabled, syncAppleCustomerOffer, syncAppleGiftCard, syncApplePasses } from './apple';
import { appleSerial } from './apple/auth';

/**
 * Tras sumar un sello, canjear un premio o cupón, enviar un cupón o mover el saldo de una gift card: actualiza TODOS
 * los pases del cliente en Google Wallet y Apple Wallet (los que estén configurados). Carga la tarjeta una sola vez.
 * Nunca lanza: un fallo de Wallet no debe impedir la operación en Caja.
 */
export async function syncCustomerWallet(businessId: string, customerId: string): Promise<void> {
  const google = googleWalletEnabled();
  const apple = appleWalletEnabled();
  if (!google && !apple) return;
  try {
    const card = await getRepo().getCustomerCard(businessId, customerId);
    if (!card) return;
    await Promise.all([
      google ? syncGoogleWallet(card) : Promise.resolve(),
      apple ? syncApplePasses(card) : Promise.resolve()
    ]);
  } catch (e) {
    console.error('syncCustomerWallet:', e instanceof Error ? e.message : e);
  }
}

/** Nombre anterior (lo usan Caja, Clientes y la página del cliente). Igual que syncCustomerWallet. */
export const syncWalletPass = syncCustomerWallet;

/** Serial de Apple o null si el id no sirve (appleSerial lanza con ids raros; aquí nunca se lanza). */
function safeSerial(kind: 'coupon' | 'gift', businessId: string, id: string): string | null {
  try { return appleSerial(kind, businessId, id); } catch { return null; }
}

/**
 * Tras canjear, terminar o enviar un cupón: es el ÚNICO lugar que hay que llamar (Google + Apple).
 *   - Google: el cupón usado ya no viene en card.offers, así que su objeto se actualiza aparte (COMPLETED / EXPIRED)
 *     y luego se sincroniza la tarjeta de sellos (desenlaza el cupón).
 *   - Apple: un solo push por dispositivo con todos los pases del cliente MÁS el serial de este cupón (sale anulado).
 *     Si el cliente ya no existe, solo se actualiza el pase del cupón (syncAppleCustomerOffer).
 * Nunca lanza.
 */
export async function syncCustomerOfferWallet(businessId: string, customerOfferId: string): Promise<void> {
  const google = googleWalletEnabled();
  const apple = appleWalletEnabled();
  if (!google && !apple) return;
  try {
    const repo = getRepo();
    const co = await repo.findCustomerOffer(businessId, customerOfferId);
    if (!co) {
      if (apple) await syncAppleCustomerOffer(businessId, customerOfferId);
      return;
    }
    const card = await repo.getCustomerCard(businessId, co.customerId);
    const tasks: Promise<unknown>[] = [];
    if (google && card) {
      tasks.push((async () => {
        // Siempre PATCH (404 = no lo guardó): customer.wallet lo puede cambiar un GET y no sirve para saltarse Google.
        await syncGoogleOfferObject(brandFromCard(card), co);
        await syncGoogleWallet(card);
      })().catch((e) => console.error('syncCustomerOfferWallet (Google):', e instanceof Error ? e.message : e)));
    }
    if (apple) {
      const serial = safeSerial('coupon', businessId, customerOfferId);
      tasks.push(card ? syncApplePasses(card, serial ? [serial] : []) : syncAppleCustomerOffer(businessId, customerOfferId));
    }
    await Promise.all(tasks);
  } catch (e) {
    console.error('syncCustomerOfferWallet:', e instanceof Error ? e.message : e);
  }
}

/**
 * Tras vender, recargar, cobrar o anular una gift card: es el ÚNICO lugar que hay que llamar (Google + Apple).
 *   - Google: PATCH de su objeto (también si se vendió sin cliente o quedó anulada, que no vienen en card.giftCards).
 *     `notify` pide aviso de Google (solo recargas; Google decide).
 *   - Apple: con cliente, un solo push por dispositivo con todos sus pases MÁS el serial de esta gift card; sin
 *     cliente, solo el pase de la gift card (syncAppleGiftCard).
 * Nunca lanza.
 */
export async function syncGiftCardWallet(businessId: string, giftCardId: string, opts: { notify?: boolean } = {}): Promise<void> {
  const google = googleWalletEnabled();
  const apple = appleWalletEnabled();
  if (!google && !apple) return;
  try {
    const repo = getRepo();
    const g = await repo.getGiftCard(businessId, giftCardId);
    if (!g) {
      if (apple) await syncAppleGiftCard(businessId, giftCardId);
      return;
    }
    const card = g.customerId ? await repo.getCustomerCard(businessId, g.customerId) : null;
    const tasks: Promise<unknown>[] = [];
    if (google) {
      tasks.push((async () => {
        let brand: GoogleBrand | undefined;
        if (card) brand = brandFromCard(card);
        else {
          const [business, program, locations] = await Promise.all([repo.getBusiness(businessId), repo.getProgram(businessId), repo.listLocations(businessId)]);
          if (business) brand = googleBrand(business, program, locations.filter((l) => l.active));
        }
        if (brand) {
          const [last] = await repo.listGiftCardMovements(businessId, g.id, 1).catch(() => []);
          // NOTIFY cuenta para el tope de avisos del cliente (3 cada 24 h): se revisa antes y se registra si se usó.
          // Sin cliente registrado no hay a quién contarle el tope (Google aplica el suyo al portador).
          let notify = !!opts.notify;
          if (notify && g.customerId) {
            const recent = await repo.countWalletNotifications(businessId, g.customerId, notifyWindowStartIso()).catch(() => WALLET_NOTIFY_MAX);
            notify = canNotify(recent);
          }
          const r = await syncGoogleGiftCardObject(brand, g, { notify, balanceUpdatedAt: last?.createdAt });
          if (notify && r === 'ok' && g.customerId) {
            await repo.logWalletNotification({ businessId, customerId: g.customerId, platform: 'google', kind: 'gift.topup' })
              .catch((e) => console.error('logWalletNotification:', e instanceof Error ? e.message : e));
          }
        }
      })().catch((e) => console.error('syncGiftCardWallet (Google):', e instanceof Error ? e.message : e)));
    }
    if (apple) {
      const serial = safeSerial('gift', businessId, g.id);
      tasks.push(card ? syncApplePasses(card, serial ? [serial] : []) : syncAppleGiftCard(businessId, g.id));
    }
    await Promise.all(tasks);
  } catch (e) {
    console.error('syncGiftCardWallet:', e instanceof Error ? e.message : e);
  }
}
