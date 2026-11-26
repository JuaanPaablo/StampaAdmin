import { getRepo } from '../repo';
import type { WalletPlatform } from '../contracts';
import { canNotify, isOfferLive, notifyWindowStartIso } from '../domain/wallet-cards';
import { googleWalletEnabled, notifyGoogle } from './google';
import { appleWalletEnabled, notifyApple } from './apple';
import { syncCustomerOfferWallet } from './sync';

/**
 * Punto ÚNICO para avisar a un cliente en Wallet (Google y Apple), respetando el tope de 3 avisos cada 24 h por
 * cliente (WALLET_NOTIFY_MAX; Google rechaza el cuarto). Cada plataforma que acepta el aviso queda registrada en
 * wallet_notifications (repo.logWalletNotification), así que con pases en ambas plataformas cuenta doble (a propósito:
 * es el lado prudente del tope). Nunca lanza.
 *
 * reason cuando no se envía: 'disabled' (ninguna Wallet configurada) · 'not_found' (no existe el cliente) ·
 * 'no_wallet' (el cliente no agregó su tarjeta) · 'cap' (ya recibió 3 avisos en 24 h) · 'unavailable' (ninguna
 * plataforma lo aceptó) · 'error'.
 */
export async function notifyCustomer(businessId: string, customerId: string, message: string, kind: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const google = googleWalletEnabled();
    const apple = appleWalletEnabled();
    if (!google && !apple) return { sent: false, reason: 'disabled' };
    const repo = getRepo();
    const card = await repo.getCustomerCard(businessId, customerId);
    if (!card) return { sent: false, reason: 'not_found' };
    if (!card.customer.wallet) return { sent: false, reason: 'no_wallet' };
    const recent = await repo.countWalletNotifications(businessId, customerId, notifyWindowStartIso());
    if (!canNotify(recent)) return { sent: false, reason: 'cap' };

    const text = message.trim().slice(0, 200);
    const attempts: [WalletPlatform, Promise<boolean>][] = [];
    if (google) attempts.push(['google', notifyGoogle(card, text).catch(() => false)]);
    if (apple) attempts.push(['apple', notifyApple(card, text).catch(() => false)]);
    let sent = false;
    for (const [platform, p] of attempts) {
      if (!(await p)) continue;
      sent = true;
      await repo.logWalletNotification({ businessId, customerId, platform, kind }).catch((e) => console.error('logWalletNotification:', e instanceof Error ? e.message : e));
    }
    return sent ? { sent: true } : { sent: false, reason: 'unavailable' };
  } catch (e) {
    console.error('notifyCustomer:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'error' };
  }
}

/** Clientes a la vez dentro de una tanda (cada uno hace llamadas a Google/Apple de hasta 4 s). */
const CONCURRENCY = 5;
/** Cupones de clientes por llamada de syncOfferBatch: cabe de sobra en el tiempo de una función de Vercel. */
export const OFFER_BATCH_SIZE = 25;

/** kind del aviso "Nuevo cupón" de una oferta en wallet_notifications (para no avisar dos veces al repetir). */
export const offerSentKind = (offerId: string): string => `offer.sent:${offerId}`.slice(0, 40);

export interface OfferBatchResult {
  /** Cupones de clientes procesados en esta tanda. */
  processed: number;
  /** Total a procesar (todos los entregados al enviar; solo los sin usar al terminar). */
  total: number;
  /** Avisos enviados en esta tanda. */
  notified: number;
  /** Ya avisados antes (se saltan al repetir). */
  alreadyNotified: number;
  /** Cursor para la siguiente tanda, o null si ya no quedan. */
  nextCursor: string | null;
}

/**
 * Una tanda del Wallet de un cupón (la pantalla la llama en bucle hasta nextCursor = null; ver OfferWalletSync):
 *   - 'send': actualiza los pases de cada cliente que recibió el cupón y le avisa "Nuevo cupón: <título>" una sola vez
 *     (kind offer.sent:<id>; si ya está registrado se salta) y respetando el tope de 3 avisos / 24 h. Repetirla es seguro.
 *   - 'end': actualiza los pases de los cupones sin usar (salen terminados), sin avisar.
 * Orden por id del customer_offer. Los fallos de Wallet de un cliente no frenan la tanda.
 */
export async function syncOfferBatch(businessId: string, offerId: string, mode: 'send' | 'end', afterId?: string, nowMs: number = Date.now()): Promise<OfferBatchResult> {
  const repo = getRepo();
  const offer = await repo.getOffer(businessId, offerId);
  const empty: OfferBatchResult = { processed: 0, total: 0, notified: 0, alreadyNotified: 0, nextCursor: null };
  if (!offer || offer.status === 'draft') return empty;
  const page = await repo.listCustomerOfferPage(businessId, offerId, { afterId, limit: OFFER_BATCH_SIZE, unredeemedOnly: mode === 'end' });
  const out: OfferBatchResult = {
    ...empty, processed: page.items.length, total: page.total,
    nextCursor: page.items.length === OFFER_BATCH_SIZE ? page.items[page.items.length - 1].id : null
  };
  if (!page.items.length || (!googleWalletEnabled() && !appleWalletEnabled())) return out;

  const notify = mode === 'send' && offer.status === 'sent' && isOfferLive(offer, nowMs);
  const kind = offerSentKind(offer.id);
  const message = `Nuevo cupón: ${offer.title}`;
  let next = 0;
  const worker = async () => {
    while (next < page.items.length) {
      const co = page.items[next++];
      try {
        await syncCustomerOfferWallet(businessId, co.id);
        if (!notify) continue;
        if (await repo.hasWalletNotification(businessId, co.customerId, kind)) { out.alreadyNotified++; continue; }
        if ((await notifyCustomer(businessId, co.customerId, message, kind)).sent) out.notified++;
      } catch (e) {
        console.error('syncOfferBatch:', e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, page.items.length) }, worker));
  return out;
}
