import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import type { Alert, Severity } from '@/lib/contracts';
import { ago, localizeTicket } from '@/lib/format';
import { cn } from '@/lib/cn';

const SEV: Record<Severity, { label: string; ring: string; text: string }> = {
  critical: { label: 'Crítica', ring: 'bg-[#FBE0DE]', text: 'text-bad' },
  warning: { label: 'Advertencia', ring: 'bg-[#FFF3CC]', text: 'text-[#7A5A00]' },
  info: { label: 'Informativa', ring: 'bg-[#E3EDF8]', text: 'text-navy' }
};

function SeverityIcon({ severity }: { severity: Severity }) {
  const c = 'h-5 w-5';
  if (severity === 'critical') {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 4.1L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4" /><path d="M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" />
    </svg>
  );
}

export function AlertList({ alerts, staffNames, range, emptyText, ticketWord = 'Ticket' }: { alerts: Alert[]; staffNames: Record<string, string>; range: string; emptyText: string; ticketWord?: string }) {
  if (alerts.length === 0) {
    return <EmptyState title="Sin alertas en este periodo" text={emptyText} />;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line/70">
      {alerts.map((a) => {
        const s = SEV[a.severity];
        return (
          <li key={a.id} className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
            <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.ring, s.text)}>
              <SeverityIcon severity={a.severity} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-navy"><span className="sr-only">{s.label}: </span>{localizeTicket(a.message, ticketWord)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>{ago(a.at)}</span>
                {a.codeId && <Link href={'/panel/caja/' + a.codeId} className="font-semibold text-navy underline underline-offset-2">Ver código</Link>}
                {a.staffId && (
                  <Link href={'/panel/control?range=' + range + '#cajero-' + a.staffId} className="font-semibold text-navy underline underline-offset-2">
                    Ver a {staffNames[a.staffId] ?? 'la persona'}
                  </Link>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
