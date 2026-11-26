import { AppleWalletBadge } from './AppleWalletBadge';
import { walletHref, type WalletKind } from './wallet-model';

const LINK = 'block w-fit rounded-full p-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/40';

/**
 * Botones oficiales "Agregar a … Wallet". Google: su imagen es-419 sin modificar, 55 px de alto y 8 px libres
 * alrededor (el p-2 del enlace). `kinds` ya viene filtrado y ordenado por plataforma (walletButtons).
 * `what` describe el pase para lectores de pantalla cuando hay varios en la página ("el cupón Café gratis").
 */
export function WalletButtons({ slug, kinds, item, what }: {
  slug: string;
  kinds: WalletKind[];
  item?: { type: 'cupon' | 'gift'; id: string };
  what?: string;
}) {
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {kinds.map((k) => k === 'google' ? (
        <a key={k} href={walletHref(slug, 'google', item)} rel="nofollow" className={LINK}
          aria-label={what ? `Agregar ${what} a Google Wallet` : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wallet/agregar-a-google-wallet.svg" alt="Agregar a Google Wallet" width={239} height={55} className="h-[55px] w-auto" />
        </a>
      ) : (
        <a key={k} href={walletHref(slug, 'apple', item)} rel="nofollow" className={LINK}
          aria-label={what ? `Agregar ${what} a Apple Wallet` : undefined}>
          <AppleWalletBadge />
        </a>
      ))}
    </div>
  );
}
