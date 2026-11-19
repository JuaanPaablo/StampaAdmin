import { Badge, EmptyState, Table, Td, Th } from '@/components/ui';
import type { StaffReportRow } from '@/lib/contracts';
import { num } from '@/lib/format';

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function StaffTable({ rows, ticketPlural, staffWord, ticketWord = 'Ticket' }: { rows: StaffReportRow[]; ticketPlural: string; staffWord: string; ticketWord?: string }) {
  const tw = ticketWord.toLowerCase();
  if (rows.length === 0) {
    return <EmptyState title="Sin actividad en este periodo" text={'Cuando el equipo genere códigos, aquí verás cuántos sellos da cada ' + staffWord + ' por ' + tw + '.'} />;
  }
  const med = median(rows.filter((r) => r.tickets > 0).map((r) => r.ratio));
  const scale = Math.max(1, med * 2, ...rows.map((r) => r.ratio));
  const sorted = [...rows].sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.ratio - a.ratio);
  return (
    <>
      <Table>
        <caption className="sr-only">Actividad por persona del equipo</caption>
        <thead>
          <tr>
            <Th>Persona</Th><Th className="text-right">{ticketPlural}</Th><Th className="text-right">Sellos</Th><Th className="text-right">Anulados</Th>
            <Th className="min-w-[200px]">Sellos por {tw}</Th><Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.staffId} id={'cajero-' + r.staffId} className={r.flagged ? 'bg-[#FFF8E1]' : undefined}>
              <Td className="font-semibold">{r.name}</Td>
              <Td className="text-right">{num(r.tickets)}</Td>
              <Td className="text-right">{num(r.stamps)}</Td>
              <Td className="text-right">{num(r.voids)}</Td>
              <Td>
                <div className="flex items-center gap-3">
                  <div className="relative h-2.5 min-w-[96px] flex-1 rounded-full bg-line" role="img"
                    aria-label={num(r.ratio, 1) + ' sellos por ' + tw + '; mediana del equipo ' + num(med, 1)}>
                    <div className={'h-full rounded-full ' + (r.flagged ? 'bg-bad' : 'bg-navy')} style={{ width: Math.min(100, (r.ratio / scale) * 100) + '%' }} />
                    <div className="absolute -top-1 w-0.5 bg-sun ring-1 ring-navy/40" style={{ left: Math.min(100, (med / scale) * 100) + '%', height: '1.125rem' }} aria-hidden />
                  </div>
                  <span className="w-9 shrink-0 text-right font-semibold">{num(r.ratio, 1)}</span>
                </div>
              </Td>
              <Td>{r.flagged ? <Badge tone="warn">Revisar</Badge> : <span className="text-xs text-muted">Normal</span>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-muted">
        Sellos por {tw} = sellos dados ÷ {ticketPlural.toLowerCase()} generados. La marca amarilla es la mediana del equipo ({num(med, 1)}); se marca “Revisar” a quien tiene 5 o más {ticketPlural.toLowerCase()} y supera 1,5 veces esa mediana.
      </p>
    </>
  );
}
