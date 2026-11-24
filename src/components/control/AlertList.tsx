import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import type { Alert, Severity } from '@/lib/contracts';
import { ago, localizeTicket } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SEVERITY_LABEL, alertAdvice } from './labels';

const SEV: Record<Severity, { ring: string; text: string; rank: number }> = {
  critical: { ring: 'bg-[#FBE0DE]', text: 'text-[#9B2A22]', rank: 0 },
  warning: { ring: 'bg-[#FFF3CC]', text: 'text-[#7A5A00]', rank: 1 },
  info: { ring: 'bg-[#E3EDF8]', text: 'text-navy', rank: 2 }
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

const linkClass = 'inline-flex min-h-[44px] items-center font-semibold text-navy underline underline-offset-2';

/**
 * Lista de alertas: urgentes primero y, dentro de cada nivel, la más reciente arriba.
 * Cada alerta muestra el nivel en texto (no solo color e ícono), qué pasó y qué hacer.
 */
export function AlertList({ alerts, staffNames, range, emptyText, ticketWord = 'Ticket', limit, canSeeStaff = true }: {
  alerts: Alert[]; staffNames: Record<string, string>; range: string; emptyText: string; ticketWord?: string;
  limit?: number; canSeeStaff?: boolean;
}) {
  if (alerts.length === 0) {
    return <EmptyState title="Todo en orden" text={emptyText} />;
  }
  const t = ticketWord.toLowerCase();
  const sorted = [...alerts].sort((a, b) => SEV[a.severity].rank - SEV[b.severity].rank || b.at.localeCompare(a.at));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line/70">
        {shown.map((a) => {
          const s = SEV[a.severity];
          const advice = alertAdvice(a.kind, t);
          return (
            <li key={a.id} className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
              <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.ring, s.text)}>
                <SeverityIcon severity={a.severity} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className={cn('font-bold uppercase tracking-wide', s.text)}>{SEVERITY_LABEL[a.severity]}</span>
                  <span className="text-muted"> · {ago(a.at)}</span>
                </p>
                <p className="mt-0.5 text-[15px] font-medium text-navy">{localizeTicket(a.message, ticketWord)}</p>
                {advice && <p className="mt-1 text-sm text-muted"><span className="font-semibold text-navy">Qué hacer: </span>{advice}</p>}
                {(a.codeId || (a.staffId && canSeeStaff)) && (
                  <p className="flex flex-wrap items-center gap-x-4 text-sm">
                    {a.codeId && <Link href={'/panel/caja/' + a.codeId} className={linkClass}>Ver código</Link>}
                    {a.staffId && canSeeStaff && (
                      <Link href={'/panel/control?range=' + range + '#cajero-' + a.staffId} className={linkClass}>
                        Ver a {staffNames[a.staffId] ?? 'la persona'}
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length < alerts.length && (
        <p className="mt-3 text-sm text-muted">Mostrando {shown.length} de {alerts.length}. Elige menos días para ver las más recientes.</p>
      )}
    </>
  );
}
