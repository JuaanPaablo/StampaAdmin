import type { StampClaim } from '@/lib/contracts';
import { cn } from '@/lib/cn';

/** Un punto por cupo: navy = reclamado, rojo = anulado, vacío = libre. Anular no libera el cupo. */
export function SeatPips({ seats, claims, size = 'md' }: { seats: number; claims: StampClaim[]; size?: 'sm' | 'md' }) {
  const ordered = [...claims].sort((a, b) => a.at.localeCompare(b.at));
  const voided = ordered.filter((c) => c.voidedAt).length;
  const used = ordered.length;
  const label = used + ' de ' + seats + (seats === 1 ? ' cupo reclamado' : ' cupos reclamados') + (voided ? ', ' + voided + (voided === 1 ? ' anulado' : ' anulados') : '');
  const dot = size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span role="img" aria-label={label} className="inline-flex flex-wrap items-center gap-1.5">
      {Array.from({ length: seats }, (_, i) => {
        const c = ordered[i];
        return (
          <span key={i} aria-hidden
            className={cn('inline-block rounded-full', dot,
              !c && 'bg-white ring-2 ring-inset ring-[#C9D6E3]',
              c && !c.voidedAt && 'bg-navy',
              c?.voidedAt && 'bg-bad')} />
        );
      })}
    </span>
  );
}
