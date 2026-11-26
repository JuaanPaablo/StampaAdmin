/**
 * Pon esto en `true` SOLO después de copiar la insignia oficial de Apple ("Add to Apple Wallet", versión es-419/ES,
 * sin modificar) en `public/wallet/agregar-a-apple-wallet.svg`. Mientras sea `false` se muestra el botón de texto
 * negro acordado en docs/TARJETAS.md: así nunca hay una imagen rota ni un parpadeo antes de hidratar.
 * (No se revisa con fs: en Vercel la carpeta public no viaja con la función.)
 */
export const APPLE_BADGE_AVAILABLE = false;

const SRC = '/wallet/agregar-a-apple-wallet.svg';

/** Insignia "Agregar a Apple Wallet" (componente de servidor, sin estado). */
export function AppleWalletBadge() {
  if (!APPLE_BADGE_AVAILABLE) {
    return (
      <span className="inline-flex h-[55px] items-center justify-center rounded-full bg-black px-6 text-base font-semibold text-white">
        Agregar a Apple Wallet
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={SRC} alt="Agregar a Apple Wallet" width={174} height={55} className="h-[55px] w-auto" />;
}
