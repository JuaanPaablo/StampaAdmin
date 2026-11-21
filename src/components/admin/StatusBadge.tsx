import { Badge } from '@/components/ui';
import type { Business } from '@/lib/contracts';
import { businessStatus } from '@/lib/mvp-rules';
import { cn } from '@/lib/cn';
import { STATUS_LABEL, STATUS_TONE, expiryInfo } from './helpers';

export function StatusBadge({ business }: { business: Pick<Business, 'status'> }) {
  const st = businessStatus(business);
  return <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>;
}

/** Vencimiento con aviso: rojo si venció, ámbar si vence en 7 días o menos. */
export function ExpiryText({ planExpiresAt, now, className }: { planExpiresAt?: string; now: number; className?: string }) {
  const e = expiryInfo(planExpiresAt, now);
  if (e.tone === 'bad' || e.tone === 'warn') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none whitespace-nowrap',
        e.tone === 'bad' ? 'bg-[#FBE0DE] text-[#9B2A22]' : 'bg-[#FFF3CC] text-[#7A5A00]', className)}>
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', e.tone === 'bad' ? 'bg-bad' : 'bg-[#B98900]')} />
        {e.label}
      </span>
    );
  }
  return <span className={cn('text-sm whitespace-nowrap', e.tone === 'none' ? 'text-muted' : 'text-navy', className)}>{e.label}</span>;
}
