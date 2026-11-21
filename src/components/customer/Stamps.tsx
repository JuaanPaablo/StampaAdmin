import { Isotipo } from '@/components/shell/logo';
import { stampCells, stampColumns } from './card-model';

/**
 * Cuadrícula de sellos (manual de marca 3.2 y 6.1): sello ganado = isotipo sobre Azul Noche con anillo amarillo;
 * pendiente = borde punteado con su número; el último, el premio, resaltado en amarillo.
 * `pop` anima el último sello ganado (solo si el sistema no pide reducir el movimiento).
 */
export function StampGrid({ total, filled, pop = false }: { total: number; filled: number; pop?: boolean }) {
  const cells = stampCells(total, filled);
  const cols = stampColumns(cells.length);
  const lastEarned = Math.min(filled, cells.length) - 1;
  return (
    <>
      {pop && <style>{POP_CSS}</style>}
      <ol
        aria-label={`${Math.min(filled, cells.length)} de ${cells.length} sellos`}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((c, i) => {
          const label = c.reward
            ? `${c.n}: premio${c.earned ? ', ganado' : ''}`
            : `Sello ${c.n}${c.earned ? ', ganado' : ', pendiente'}`;
          const anim = pop && i === lastEarned ? ' stampa-pop' : '';
          if (c.earned) {
            return (
              <li key={c.n} aria-label={label}
                className={'flex aspect-square items-center justify-center rounded-full ring-[3px] ring-sun ring-offset-2 ring-offset-white ' + (c.reward ? 'bg-sun' : 'bg-navy') + anim}>
                <Isotipo size={40} color={c.reward ? '#001D3D' : '#FFFFFF'} dot={c.reward ? '#FFFFFF' : '#FFC301'} className="h-[58%] w-[58%]" />
              </li>
            );
          }
          if (c.reward) {
            return (
              <li key={c.n} aria-label={label}
                className="flex aspect-square flex-col items-center justify-center rounded-full border-[2.5px] border-dashed border-[#B88A00] bg-[#FFF4CC] text-navy">
                <GiftIcon />
                <span className="font-display text-[11px] font-bold leading-none tabular-nums">{c.n}</span>
              </li>
            );
          }
          return (
            <li key={c.n} aria-label={label}
              className="flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-[#8DA2B8] font-display text-sm font-semibold tabular-nums text-muted">
              {c.n}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mb-0.5 h-[38%] w-[38%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v9H5v-9" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

/** Barra amarilla de progreso con "Sellos 7 / 10". */
export function StampProgress({ filled, total }: { filled: number; total: number }) {
  const v = Math.max(0, Math.min(filled, total));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Sellos</span>
        <span className="font-display text-2xl font-bold tabular-nums text-navy">{v} <span className="text-muted">/</span> {total}</span>
      </div>
      <div role="progressbar" aria-label="Progreso de la tarjeta" aria-valuemin={0} aria-valuemax={total} aria-valuenow={v}
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-sun" style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

const POP_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes stampa-pop { 0% { transform: scale(1.9) rotate(-14deg); opacity: 0; } 55% { transform: scale(.92) rotate(3deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
  .stampa-pop { animation: stampa-pop .6s cubic-bezier(.2,.9,.3,1.2) .15s both; }
}`;
