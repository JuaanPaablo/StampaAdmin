import type { CustomerCard } from '../../contracts';
import { getRepo } from '../../repo';
import { isOfferLive } from '../../domain/wallet-cards';
import { pushPassUpdate } from './apns';
import { appleSerial } from './auth';
import { appleWalletConfig, type AppleWalletConfig } from './config';
import { FRESH_COUPON_MS } from './passes';

/**
 * Apple Wallet (iPhone). Punto de entrada que usan la interfaz, sync.ts y notify.ts. Firmas FIJAS (docs/TARJETAS.md).
 * Módulos: pkpass.ts (zip + manifest + firma CMS), passes.ts (pass.json), apns.ts (push), auth.ts (serial y token),
 * service.ts (armar el pase desde la base), config.ts (variables).
 */

/** true solo si TODAS las variables APPLE_* obligatorias están presentes y bien formadas (ver config.ts). */
export function appleWalletEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return appleWalletConfig(env) !== null;
}

/**
 * Marca los seriales como cambiados (para appleSerialsForDevice) y manda UN push vacío a cada dispositivo que tenga
 * alguno. Devuelve a cuántos dispositivos aceptó APNs. Nunca lanza.
 */
export async function syncAppleSerials(serials: string[], cfg: AppleWalletConfig | null = appleWalletConfig()): Promise<number> {
  if (!cfg || !serials.length) return 0;
  try {
    const repo = getRepo();
    const tokens = new Set<string>();
    for (const serial of new Set(serials)) {
      const t = await repo.applePushTokensForSerial(cfg.passTypeId, serial);
      if (!t.length) continue;
      await repo.appleMarkUpdated(cfg.passTypeId, serial);
      t.forEach((x) => tokens.add(x));
    }
    if (!tokens.size) return 0;
    const { sent, gone } = await pushPassUpdate([...tokens], cfg);
    // APNs 410 / token inválido: el dispositivo ya no tiene la app Wallet con ese token. Se borran sus registros (si
    // el pase sigue instalado, iOS lo vuelve a registrar con el token nuevo).
    if (gone.length) {
      console.warn(`Apple Wallet: ${gone.length} dispositivo(s) ya no tienen el pase (APNs 410); se borran sus registros.`);
      await Promise.all(gone.map((t) => repo.appleUnregisterToken(t).catch((e) => {
        console.error('Apple Wallet baja por token:', e instanceof Error ? e.message : e);
      })));
    }
    return sent;
  } catch (e) {
    console.error('syncAppleSerials:', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Seriales de los pases del cliente: sellos, sus cupones vigentes y TODAS sus gift cards (también anuladas). */
async function serialsFor(card: CustomerCard): Promise<string[]> {
  const biz = card.business.id;
  const serials = [appleSerial('stamp', biz, card.customer.id)];
  for (const co of card.offers ?? []) serials.push(appleSerial('coupon', biz, co.id));
  let gifts = card.giftCards ?? [];
  try { gifts = await getRepo().listGiftCards(biz, { customerId: card.customer.id }); } catch { /* quedan las activas */ }
  for (const g of gifts) serials.push(appleSerial('gift', biz, g.id));
  return serials;
}

/**
 * Actualiza en los iPhone todos los pases del cliente (sellos, cupones y gift cards): marca los seriales como
 * cambiados (repo.appleMarkUpdated) y manda el push APNs vacío. Nunca lanza.
 *
 * `extraSerials` suma seriales que no salen de la tarjeta (ej. el cupón recién USADO, que ya no viene en
 * card.offers) para que cada dispositivo reciba UN solo push. sync.ts lo usa; nadie más necesita llamarlo aparte.
 */
export async function syncApplePasses(card: CustomerCard, extraSerials: string[] = []): Promise<void> {
  const cfg = appleWalletConfig();
  if (!cfg) return;
  try {
    await syncAppleSerials([...(await serialsFor(card)), ...extraSerials], cfg);
  } catch (e) {
    console.error('syncApplePasses:', e instanceof Error ? e.message : e);
  }
}

/** Tras canjear o terminar un cupón: actualiza ese pase (sale anulado). Nunca lanza. */
export async function syncAppleCustomerOffer(businessId: string, customerOfferId: string): Promise<void> {
  try { await syncAppleSerials([appleSerial('coupon', businessId, customerOfferId)]); }
  catch (e) { console.error('syncAppleCustomerOffer:', e instanceof Error ? e.message : e); }
}

/** Tras mover el saldo de una gift card (también las vendidas sin cliente). Nunca lanza. */
export async function syncAppleGiftCard(businessId: string, giftCardId: string): Promise<void> {
  try { await syncAppleSerials([appleSerial('gift', businessId, giftCardId)]); }
  catch (e) { console.error('syncAppleGiftCard:', e instanceof Error ? e.message : e); }
}

/**
 * Muestra un aviso en la pantalla bloqueada (campo con changeMessage + push). true si se envió a algún dispositivo.
 * Nunca lanza.
 *
 * iOS solo muestra textos de campos del pase que cambiaron, y el pase se arma de nuevo desde la base cuando el iPhone
 * lo pide. Hoy el único aviso que la base puede reconstruir es "Nuevo cupón: <título>" (campo CUPÓN de la tarjeta de
 * sellos, con changeMessage mientras el cupón es nuevo). Cualquier otro texto devuelve false hasta que el repo guarde
 * el último aviso (ver docs/WALLET.md → Apple).
 */
export async function notifyApple(card: CustomerCard, message: string): Promise<boolean> {
  const cfg = appleWalletConfig();
  if (!cfg) return false;
  try {
    const now = Date.now();
    const fresh = (card.offers ?? []).filter((co) => !co.redeemedAt && isOfferLive(co.offer, now) && now - Date.parse(co.createdAt) < FRESH_COUPON_MS);
    const newest = fresh.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!newest || message.trim() !== `Nuevo cupón: ${newest.offer.title}`.trim()) return false;
    return (await syncAppleSerials([appleSerial('stamp', card.business.id, card.customer.id)], cfg)) > 0;
  } catch (e) {
    console.error('notifyApple:', e instanceof Error ? e.message : e);
    return false;
  }
}
