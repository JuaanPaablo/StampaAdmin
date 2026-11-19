import Link from 'next/link';
import type { RangeKey } from '@/lib/contracts';
import { cn } from '@/lib/cn';
import { RANGE_LABEL } from './helpers';

/** Selector de rango por enlaces (funciona sin JavaScript). */
export function RangeTabs({ current, basePath = '/panel' }: { current: RangeKey; basePath?: string }) {
  return (
    <nav aria-label="Rango de fechas" className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-[#C9D6E3]">
      {(['7d', '30d', '90d'] as RangeKey[]).map((r) => (
        <Link key={r} href={`${basePath}?rango=${r}`} aria-current={r === current ? 'page' : undefined} scroll={false}
          className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition',
            r === current ? 'bg-navy text-white' : 'text-navy hover:bg-surface')}>
          {RANGE_LABEL[r]}
        </Link>
      ))}
    </nav>
  );
}
