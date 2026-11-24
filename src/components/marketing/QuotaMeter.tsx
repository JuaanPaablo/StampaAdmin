import { cn } from '@/lib/cn';
import type { Quota } from '@/lib/marketing/service';

/** Cuántos usos quedan este mes, con barra. Se renuevan el día 1. */
export function QuotaMeter({ quota, noun, label: aria }: { quota: Quota; noun: string; label: string }) {
  const low = quota.left <= Math.max(1, Math.ceil(quota.limit * 0.2));
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span>Te quedan <strong className={quota.left <= 0 ? 'text-bad' : 'text-navy'}>{quota.left} de {quota.limit}</strong> {noun}{low ? ' · se renuevan el día 1' : ''}</span>
      <div className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-[#E3EAF2] sm:w-24" role="meter" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.left} aria-label={aria}>
        <div className={cn('h-full rounded-full', quota.left <= 0 ? 'bg-bad' : low ? 'bg-[#E0B400]' : 'bg-navy')} style={{ width: `${Math.min(100, (quota.left / Math.max(1, quota.limit)) * 100)}%` }} />
      </div>
    </div>
  );
}
