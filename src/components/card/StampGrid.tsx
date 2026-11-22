import type { CSSProperties } from 'react';
import { alpha, readableOn } from './contrast';

/** Isotipo de Stampa (viewBox 0 0 100 100). */
export function Isotype({ color, className, style }: { color: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className} style={style} fill={color}>
      <path d="M56.10 19.98A38 38 0 1 0 80.02 43.90A22 22 0 0 1 56.10 19.98Z" />
      <circle cx="78" cy="22" r="11" />
    </svg>
  );
}

function Star({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[55%] w-[55%]" fill={color}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.2 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
    </svg>
  );
}

export function gridColumns(n: number): number {
  if (n <= 8) return 4;
  if (n <= 10) return 5;
  if (n <= 12) return 6;
  if (n <= 15) return 5;
  if (n <= 16) return 8;
  if (n <= 18) return 6;
  return 5;
}

export interface StampGridProps {
  total: number;
  filled: number;
  bg: string;
  accent: string;
  ink: string;
  /** Texto para lectores de pantalla. */
  label?: string;
  /** Sellos con premio intermedio. */
  milestones?: number[];
}

/** Rejilla de círculos. El último es el premio. */
export function StampGrid({ total, filled, bg, accent, ink, label, milestones }: StampGridProps) {
  const gifts = new Set(milestones ?? []);
  const cols = gridColumns(total);
  const done = Math.max(0, Math.min(total, filled));
  return (
    <div
      role="img"
      aria-label={label ?? `${done} de ${total} sellos`}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isReward = i === total - 1 || gifts.has(i + 1);
        const isFilled = i < done;
        const base: CSSProperties = { aspectRatio: '1 / 1' };
        if (isReward) {
          return (
            <div key={i} className="flex items-center justify-center rounded-full"
              style={{ ...base, background: isFilled ? accent : 'transparent', border: `2.5px solid ${accent}` }}>
              <Star color={isFilled ? readableOn(accent) : accent} />
            </div>
          );
        }
        return (
          <div key={i} className="flex items-center justify-center rounded-full"
            style={{ ...base, background: isFilled ? accent : alpha(ink, 0.08), border: isFilled ? `2px solid ${accent}` : `2px dashed ${alpha(ink, 0.35)}` }}>
            <Isotype color={isFilled ? bg : alpha(ink, 0.3)} className="h-[62%] w-[62%]" />
          </div>
        );
      })}
    </div>
  );
}
