import Link from 'next/link';
import type { RangeKey } from '@/lib/contracts';
import { cn } from '@/lib/cn';
import { RANGE_LABEL } from './helpers';

/**
 * Selector de rango por enlaces (funciona sin JavaScript).
 * Botones de 44 px de alto para el dedo; el rango bloqueado por plan lo dice en texto, no solo con el candado.
 */
export function RangeTabs({ current, basePath = '/panel', maxDays = 90 }: { current: RangeKey; basePath?: string; maxDays?: number }) {
  return (
    <nav aria-label="Rango de fechas" className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-[#C9D6E3]">
      {(['7d', '30d', '90d'] as RangeKey[]).map((r) => Number.parseInt(r, 10) > maxDays ? (
        <span key={r} title="Disponible desde el plan Standard" aria-disabled="true"
          className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-full px-3.5 text-[13px] font-semibold text-muted">
          {RANGE_LABEL[r]} <span aria-hidden="true" className="ml-1">🔒</span>
          <span className="sr-only">: disponible desde el plan Standard</span>
        </span>
      ) : (
        <Link key={r} href={`${basePath}?rango=${r}`} aria-current={r === current ? 'page' : undefined} scroll={false}
          className={cn('inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[13px] font-semibold transition',
            r === current ? 'bg-navy text-white' : 'text-navy hover:bg-surface')}>
          {RANGE_LABEL[r]}
        </Link>
      ))}
    </nav>
  );
}
