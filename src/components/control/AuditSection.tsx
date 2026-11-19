import { btnClass, EmptyState, Select, Table, Td, Th } from '@/components/ui';
import type { AuditEntry } from '@/lib/contracts';
import { dayClock } from '@/components/register/time';
import type { Vocabulary } from '@/lib/templates';
import { auditLabel } from './labels';
import { localizeTicket } from '@/lib/format';

export function AuditSection({ entries, actions, selected, range, staffNames, timezone, vocab }: {
  entries: AuditEntry[]; actions: string[]; selected: string; range: string; staffNames: Record<string, string>; timezone: string;
  vocab: Pick<Vocabulary, 'reward' | 'ticket'>;
}) {
  const exportHref = '/panel/control/exportar' + (selected ? '?accion=' + encodeURIComponent(selected) : '');
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <form method="get" action="/panel/control" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="range" value={range} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="accion" className="text-xs font-semibold tracking-wide text-muted">Filtrar por acción</label>
            <Select id="accion" name="accion" defaultValue={selected} className="h-10 w-56">
              <option value="">Todas</option>
              {actions.map((a) => <option key={a} value={a}>{auditLabel(a, vocab)}</option>)}
            </Select>
          </div>
          <button type="submit" className={btnClass('dark', 'sm')}>Filtrar</button>
        </form>
        <a href={exportHref} download className={btnClass('ghost', 'sm')}>Exportar CSV</a>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Sin movimientos" text={selected ? 'No hay registros con esa acción. Prueba con “Todas”.' : 'Cada código, anulación, canje y cambio de reglas queda registrado aquí.'} />
      ) : (
        <Table>
          <caption className="sr-only">Registro de actividad</caption>
          <thead><tr><Th>Hora</Th><Th>Quién</Th><Th>Acción</Th><Th>Detalle</Th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{dayClock(e.at, timezone)}</Td>
                <Td className="whitespace-nowrap">{e.staffId ? staffNames[e.staffId] ?? '—' : 'Sistema'}</Td>
                <Td className="whitespace-nowrap font-semibold">{auditLabel(e.action, vocab)}</Td>
                <Td className="min-w-[220px] whitespace-normal text-muted">{localizeTicket(e.detail, vocab.ticket)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
