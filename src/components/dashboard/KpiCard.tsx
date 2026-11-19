import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

/** Tarjeta de indicador con variación. Colores de variación con contraste AA y sentido en texto, no solo color. */
export function KpiCard({ label, value, hint, delta }: {
  label: string; value: ReactNode; hint?: string; delta?: { value: string; good: boolean };
}) {
  return (
    <Card as="div" className="flex flex-col gap-1 !p-4 sm:!p-5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="font-display text-2xl font-bold tracking-tight text-navy tabular-nums sm:text-3xl">{value}</span>
      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {delta && (
          <span className={delta.good ? 'font-semibold text-[#12683F]' : 'font-semibold text-[#9B2A22]'}>
            {delta.value}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </span>
    </Card>
  );
}
