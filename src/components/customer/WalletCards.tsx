import QRCode from 'qrcode';
import type { CustomerCard } from '@/lib/contracts';
import { formatCents, liveCustomerOffers } from '@/lib/domain/wallet-cards';
import { WalletButtons } from './WalletButtons';
import { couponQrText, giftQrText, spacedGiftCode, validityText, type WalletKind } from './wallet-model';

/** QR en SVG (sin red ni base de datos): Azul Noche sobre blanco con margen para que el lector lo tome rápido. */
async function qrSvg(text: string): Promise<string | null> {
  try {
    return await QRCode.toString(text, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#001D3D', light: '#FFFFFF' } });
  } catch {
    return null;
  }
}

function Qr({ svg, label }: { svg: string | null; label: string }) {
  if (!svg) return null;
  return (
    <div role="img" aria-label={label}
      className="mx-auto w-48 max-w-full rounded-xl bg-white p-1 ring-1 ring-line [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/**
 * "Mis cupones" y "Mis gift cards" debajo de la tarjeta de sellos. Usa lo que ya trae la tarjeta (card.offers y
 * card.giftCards, cargados junto con ella): no hace consultas extra.
 */
export async function WalletCards({ card, walletKinds }: { card: CustomerCard; walletKinds: WalletKind[] }) {
  const slug = card.business.slug;
  const offers = liveCustomerOffers(card.offers ?? []);
  const gifts = (card.giftCards ?? []).filter((g) => g.status === 'active');
  if (offers.length === 0 && gifts.length === 0) return null;

  const [offerQrs, giftQrs] = await Promise.all([
    Promise.all(offers.map((co) => qrSvg(couponQrText(co.id)))),
    Promise.all(gifts.map((g) => qrSvg(giftQrText(g.code))))
  ]);

  return (
    <div className="space-y-6">
      {offers.length > 0 && (
        <section aria-labelledby="mis-cupones" className="space-y-3">
          <h2 id="mis-cupones" className="font-display text-xl font-bold text-navy">Mis cupones</h2>
          <ul className="space-y-4">
            {offers.map((co, i) => (
              <li key={co.id} className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70">
                {co.offer.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={co.offer.imageUrl} alt="" referrerPolicy="no-referrer" className="h-32 w-full object-cover" />
                )}
                <div className="space-y-3 px-5 py-5">
                  <div>
                    <h3 className="font-display text-lg font-bold leading-snug text-navy">{co.offer.title}</h3>
                    {co.offer.description && <p className="mt-1 text-[15px] text-navy">{co.offer.description}</p>}
                    <p className="mt-1 text-sm font-semibold text-muted">{validityText(co.offer.startsAt, co.offer.endsAt)}</p>
                    {co.offer.terms && <p className="mt-1 text-xs text-muted">{co.offer.terms}</p>}
                  </div>
                  <Qr svg={offerQrs[i]} label={`Código QR del cupón ${co.offer.title}`} />
                  <p className="text-center text-sm text-muted">Muestra este código en caja. Se usa una sola vez.</p>
                  <WalletButtons slug={slug} kinds={walletKinds} item={{ type: 'cupon', id: co.id }} what={`el cupón ${co.offer.title}`} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gifts.length > 0 && (
        <section aria-labelledby="mis-gift-cards" className="space-y-3">
          <h2 id="mis-gift-cards" className="font-display text-xl font-bold text-navy">Mis gift cards</h2>
          <ul className="space-y-4">
            {gifts.map((g, i) => (
              <li key={g.id} className="rounded-3xl bg-white px-5 py-5 shadow-card ring-1 ring-line/70">
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-muted">Saldo disponible</p>
                    <p className="font-display text-4xl font-bold tabular-nums text-navy">{formatCents(g.balanceCents)}</p>
                  </div>
                  <Qr svg={giftQrs[i]} label={`Código QR de tu gift card con saldo ${formatCents(g.balanceCents)}`} />
                  <p className="text-center font-mono text-lg font-semibold tracking-[0.2em] text-navy" aria-label={`Código ${g.code.split('').join(' ')}`}>
                    {spacedGiftCode(g.code)}
                  </p>
                  <p className="text-center text-sm text-muted">Muestra este código en caja para pagar con tu saldo. No lo compartas.</p>
                  <WalletButtons slug={slug} kinds={walletKinds} item={{ type: 'gift', id: g.id }} what={`tu gift card de ${formatCents(g.balanceCents)}`} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
