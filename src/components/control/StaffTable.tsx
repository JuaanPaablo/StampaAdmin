import { Badge, EmptyState } from '@/components/ui';
import type { StaffReportRow } from '@/lib/contracts';
import { num } from '@/lib/format';
import { cn } from '@/lib/cn';

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Reporte por persona del equipo. Es una lista (no una tabla ancha) para que se lea a 360 px sin desplazarse de lado.
 * Quien está fuera de lo normal va primero, con fondo amarillo, la palabra "Revisar" y la barra en rojo: no depende solo del color.
 */
export function StaffTable({ rows, ticketPlural, staffWord, ticketWord = 'Ticket' }: { rows: StaffReportRow[]; ticketPlural: string; staffWord: string; ticketWord?: string }) {
  const tw = ticketWord.toLowerCase();
  const tpl = ticketPlural.toLowerCase();
  if (rows.length === 0) {
    return <EmptyState title="Sin actividad en este periodo" text={`Aquí verás a cada ${staffWord} cuando genere códigos.`} />;
  }
  const med = median(rows.filter((r) => r.tickets > 0).map((r) => r.ratio));
  const scale = Math.max(1, med * 2, ...rows.map((r) => r.ratio));
  const sorted = [...rows].sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.ratio - a.ratio);
  return (
    <>
      <ul aria-label="Actividad por persona del equipo" className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line/70">
        {sorted.map((r) => (
          <li key={r.staffId} id={'cajero-' + r.staffId}
            className={cn('scroll-mt-6 px-4 py-3.5 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5', r.flagged && 'bg-[#FFF8E1]')}>
            <div className="flex items-center justify-between gap-3 sm:block">
              <p className="truncate font-semibold text-navy">{r.name}</p>
              <span className="sm:hidden">{r.flagged ? <Badge tone="warn">Revisar</Badge> : <span className="text-xs text-muted">Normal</span>}</span>
            </div>
            <div className="mt-2 sm:mt-0">
              <div className="flex items-center gap-3">
                <div className="relative h-2.5 min-w-[96px] flex-1 rounded-full bg-line" role="img"
                  aria-label={num(r.ratio, 1) + ' sellos por ' + tw + '; lo normal en tu equipo es ' + num(med, 1)}>
                  <div className={'h-full rounded-full ' + (r.flagged ? 'bg-bad' : 'bg-navy')} style={{ width: Math.min(100, (r.ratio / scale) * 100) + '%' }} />
                  <div className="absolute -top-1 w-0.5 bg-sun ring-1 ring-navy/40" style={{ left: Math.min(100, (med / scale) * 100) + '%', height: '1.125rem' }} aria-hidden />
                </div>
                <span className="shrink-0 text-right text-sm tabular-nums text-navy"><b>{num(r.ratio, 1)}</b> <span className="text-xs text-muted">por {tw}</span></span>
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted">
                {num(r.tickets)} {tpl} · {num(r.stamps)} sellos · {num(r.voids)} {r.voids === 1 ? 'anulado' : 'anulados'}
              </p>
            </div>
            <span className="hidden sm:block">{r.flagged ? <Badge tone="warn">Revisar</Badge> : <span className="text-xs text-muted">Normal</span>}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        <span aria-hidden="true" className="mr-1 inline-block h-3 w-0.5 translate-y-0.5 bg-sun ring-1 ring-navy/40" />
        Lo normal en tu equipo: {num(med, 1)} sellos por {tw}. “Revisar”: 50 % más que lo normal, con 5 o más {tpl}.
      </p>
    </>
  );
}
