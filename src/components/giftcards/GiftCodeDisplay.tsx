import { formatCents } from '@/lib/domain/wallet-cards';
import { giftCodeSpaced } from './gift-format';

/** Código grande + QR para entregar la gift card (pantalla para mostrar o fotografiar). Sin estado. */
export function GiftCodeDisplay({ code, qrSvg, balanceCents, businessName, customerName }: {
  code: string; qrSvg: string; balanceCents: number; businessName: string; customerName?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-card ring-1 ring-line/70">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Gift card · {businessName}</p>
      <p className="font-display text-4xl font-bold tabular-nums text-navy">{formatCents(balanceCents)}</p>
      {customerName && <p className="text-sm text-muted">Para {customerName}</p>}
      <div className="w-56 max-w-full [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="Código QR de la gift card" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <p className="select-all font-mono text-2xl font-bold tracking-[0.18em] text-navy sm:text-[28px]" aria-label={`Código ${code.split('').join(' ')}`}>
        {giftCodeSpaced(code)}
      </p>
      <p className="text-xs text-muted">En caja escanean el QR o escriben este código para cobrar.</p>
    </div>
  );
}
