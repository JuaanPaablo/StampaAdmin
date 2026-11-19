import type { Program } from '@/lib/contracts';

/** Isotipo del sello: anillo con marca de verificación. */
function Mark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" aria-hidden fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M7.8 12.4l2.8 2.8 5.6-5.8" />
    </svg>
  );
}

/** Tarjeta de sellos como la ve el cliente: círculos con el isotipo, con los colores del programa. */
export function StampDots({ filled, total, colors, logoText, title, subtitle }: {
  filled: number; total: number; colors: Program['colors']; logoText?: string; title?: string; subtitle?: string;
}) {
  const cols = total <= 8 ? 4 : total <= 10 ? 5 : total <= 12 ? 6 : total <= 15 ? 5 : 7;
  const done = Math.min(filled, total);
  return (
    <div className="rounded-2xl p-5 shadow-card" style={{ background: colors.bg, color: colors.ink }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {title && <p className="truncate font-display text-base font-bold">{title}</p>}
          {subtitle && <p className="truncate text-xs opacity-80">{subtitle}</p>}
        </div>
        {logoText && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: colors.accent, color: colors.bg }} aria-hidden>
            {logoText.slice(0, 3)}
          </span>
        )}
      </div>
      <div role="img" aria-label={`${done} de ${total} sellos`} className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, i) => {
          const on = i < done;
          return (
            <span key={i} className="grid aspect-square place-items-center rounded-full"
              style={on ? { background: colors.accent } : { border: `2px dashed ${colors.ink}`, opacity: 0.45 }}>
              {on && <Mark color={colors.bg} />}
            </span>
          );
        })}
      </div>
      <p className="mt-4 text-sm font-semibold tabular-nums">{done} de {total} sellos</p>
    </div>
  );
}
