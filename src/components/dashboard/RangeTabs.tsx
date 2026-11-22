import Link from 'next/link';
import type { RangeKey } from '@/lib/contracts';
import { cn } from '@/lib/cn';
import { RANGE_LABEL } from './helpers';

/** Selector de rango por enlaces (funciona sin JavaScript). */
export function RangeTabs({ current, basePath = '/panel', maxDays = 90 }: { current: RangeKey; basePath?: string; maxDays?: number }) {
  return (
    <nav aria-label="Rango de fechas" className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-[#C9D6E3]">
      {(['7d', '30d', '90d'] as RangeKey[]).map((r) => Number.parseInt(r, 10) > maxDays ? (
        <span key={r} title="Disponible desde el plan Standard" aria-disabled="true"
          className="cursor-not-allowed rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-muted/60">
          {RANGE_LABEL[r]} <span aria-hidden="true">🔒</span>
        </span>
      ) : (
        <Link key={r} href={`${basePath}?rango=${r}`} aria-current={r === current ? 'page' : undefined} scroll={false}
          className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition',
            r === current ? 'bg-navy text-white' : 'text-navy hover:bg-surface')}>
          {RANGE_LABEL[r]}
        </Link>
      ))}
    </nav>
  );
}
