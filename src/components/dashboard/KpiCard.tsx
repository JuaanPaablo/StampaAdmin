import type { ReactNode } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { DeltaDir } from './helpers';

const ARROW: Record<DeltaDir, string> = { up: '↑', down: '↓', flat: '=', new: '' };

/**
 * Tarjeta de indicador con variación contra el periodo anterior.
 * La variación lleva flecha y frase para lectores de pantalla: no depende solo del color (verde/rojo con contraste AA).
 * `primary` agranda la cifra para marcar los indicadores principales.
 */
export function KpiCard({ label, value, hint, delta, primary }: {
  label: string; value: ReactNode; hint?: string; primary?: boolean;
  delta?: { value: string; good: boolean; dir?: DeltaDir; words?: string };
}) {
  const dir = delta?.dir ?? (delta?.good ? 'up' : 'down');
  const neutral = dir === 'flat' || dir === 'new';
  return (
    <Card as="div" className="flex flex-col gap-1 !p-4 sm:!p-5">
      <span className="text-[13px] font-medium leading-snug text-muted">{label}</span>
      <span className={cn('font-display font-bold tracking-tight text-navy tabular-nums',
        primary ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl')}>{value}</span>
      {(delta || hint) && (
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {delta && (
            <span className={cn('font-semibold', neutral ? 'text-muted' : delta.good ? 'text-[#12683F]' : 'text-[#9B2A22]')}>
              {ARROW[dir] && <span aria-hidden="true">{ARROW[dir]} </span>}
              <span aria-hidden={delta.words ? true : undefined}>{delta.value}</span>
              {delta.words && <span className="sr-only">{delta.words}</span>}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </span>
      )}
    </Card>
  );
}
