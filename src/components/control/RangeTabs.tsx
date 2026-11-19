import Link from 'next/link';
import type { RangeKey } from '@/lib/contracts';
import { cn } from '@/lib/cn';

const LABELS: Record<RangeKey, string> = { '7d': '7 días', '30d': '30 días', '90d': '90 días' };

export function RangeTabs({ range, accion }: { range: RangeKey; accion?: string }) {
  return (
    <nav aria-label="Periodo" className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-[#C9D6E3]">
      {(Object.keys(LABELS) as RangeKey[]).map((k) => {
        const qs = new URLSearchParams({ range: k });
        if (accion) qs.set('accion', accion);
        return (
          <Link key={k} href={'/panel/control?' + qs.toString()} aria-current={k === range ? 'page' : undefined}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', k === range ? 'bg-navy text-white' : 'text-navy hover:bg-surface')}>
            {LABELS[k]}
          </Link>
        );
      })}
    </nav>
  );
}
