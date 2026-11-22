import Link from 'next/link';
import { Card, EmptyState } from '@/components/ui';
import type { CodeStatus, StampCode } from '@/lib/contracts';
import { ago, money } from '@/lib/format';
import { SeatPips } from './SeatPips';
import { StatusBadge } from './StatusBadge';
import { groupCode } from './time';

export function RecentCodes({ codes, statuses, ticketWord, showAmount, excludeId }: {
  codes: StampCode[]; statuses: Record<string, CodeStatus>; ticketWord: string; showAmount: boolean; excludeId?: string;
}) {
  const rows = codes.filter((c) => c.id !== excludeId);
  return (
    <section aria-labelledby="ultimos-h">
      <h2 id="ultimos-h" className="mb-3 font-display text-lg font-semibold text-navy">Últimos códigos</h2>
      {rows.length === 0 ? (
        <EmptyState title="Aún no hay códigos" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={'/panel/caja/' + c.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface focus-visible:bg-surface sm:px-5 sm:py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-navy">{ticketWord} {c.ticket}{showAmount && c.amountCents > 0 ? ' · ' + money(c.amountCents) : ''}</span>
                    <span className="block text-xs text-muted tabular-nums"><span className="font-mono">{groupCode(c.code)}</span> · {ago(c.createdAt)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={statuses[c.id]} />
                    <SeatPips seats={c.seats} claims={c.claims} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
