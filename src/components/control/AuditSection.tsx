import Link from 'next/link';
import { btnClass, EmptyState, Select, Table, Td, Th } from '@/components/ui';
import type { AuditEntry } from '@/lib/contracts';
import { dayClock } from '@/components/register/time';
import type { Vocabulary } from '@/lib/templates';
import { auditLabel } from './labels';
import { localizeTicket } from '@/lib/format';

export function AuditSection({ entries, actions, selected, range, staffNames, timezone, vocab, page = 1, pages = 1, total, pageSize = 20 }: {
  entries: AuditEntry[]; actions: string[]; selected: string; range: string; staffNames: Record<string, string>; timezone: string;
  vocab: Pick<Vocabulary, 'reward' | 'ticket'>; page?: number; pages?: number; total?: number; pageSize?: number;
}) {
  const pageHref = (p: number) => {
    const q = new URLSearchParams({ range });
    if (selected) q.set('accion', selected);
    if (p > 1) q.set('pagina', String(p));
    return '/panel/control?' + q.toString() + '#actividad';
  };
  const count = total ?? entries.length;
  const from = (page - 1) * pageSize + 1;
  const to = from + entries.length - 1;
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
      {count > 0 && (
        <nav aria-label="Páginas del registro" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Mostrando {from} a {to} de {count}</span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={pageHref(page - 1)} scroll={false} className={btnClass('ghost', 'sm')} rel="prev">Anterior</Link> : null}
              <span className="inline-flex h-9 items-center px-2">Página {page} de {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} scroll={false} className={btnClass('ghost', 'sm')} rel="next">Siguiente</Link> : null}
            </div>
          )}
        </nav>
      )}
    </>
  );
}
