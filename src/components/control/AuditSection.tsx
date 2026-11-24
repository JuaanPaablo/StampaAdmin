import Link from 'next/link';
import { btnClass, EmptyState, Select, Table, Td, Th } from '@/components/ui';
import type { AuditEntry } from '@/lib/contracts';
import { dayClock } from '@/components/register/time';
import type { Vocabulary } from '@/lib/templates';
import { auditLabel } from './labels';
import { localizeTicket } from '@/lib/format';

const tall = ' min-h-[44px]';

/**
 * Historial de cambios con filtro por tipo de acción, paginación y descarga.
 * En el celular cada movimiento es una tarjeta; desde `sm` es una tabla.
 */
export function AuditSection({ entries, actions, selected, range, staffNames, timezone, vocab, page = 1, pages = 1, total, pageSize = 20, canExport = true }: {
  entries: AuditEntry[]; actions: string[]; selected: string; range: string; staffNames: Record<string, string>; timezone: string;
  vocab: Pick<Vocabulary, 'reward' | 'ticket'>; page?: number; pages?: number; total?: number; pageSize?: number; canExport?: boolean;
}) {
  const pageHref = (p: number) => {
    const q = new URLSearchParams({ range });
    if (selected) q.set('accion', selected);
    if (p > 1) q.set('pagina', String(p));
    return '/panel/control?' + q.toString() + '#actividad';
  };
  const clearHref = '/panel/control?' + new URLSearchParams({ range }).toString() + '#actividad';
  const count = total ?? entries.length;
  const from = (page - 1) * pageSize + 1;
  const to = from + entries.length - 1;
  const exportHref = '/panel/control/exportar' + (selected ? '?accion=' + encodeURIComponent(selected) : '');
  const who = (e: AuditEntry) => (e.staffId ? staffNames[e.staffId] ?? '—' : 'Sistema');
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <form method="get" action="/panel/control#actividad" className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <input type="hidden" name="range" value={range} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none">
            <label htmlFor="accion" className="text-xs font-semibold tracking-wide text-muted">Mostrar</label>
            <Select id="accion" name="accion" defaultValue={selected} className="w-full sm:w-56">
              <option value="">Todo</option>
              {actions.map((a) => <option key={a} value={a}>{auditLabel(a, vocab)}</option>)}
            </Select>
          </div>
          <button type="submit" className={btnClass('dark', 'md')}>Ver</button>
          {selected && <Link href={clearHref} scroll={false} className={btnClass('ghost', 'md')}>Quitar filtro</Link>}
        </form>
        {canExport && count > 0 && (
          <a href={exportHref} download className={btnClass('ghost', 'md')}>
            Descargar para Excel<span className="sr-only"> (archivo CSV{selected ? ', solo lo filtrado' : ''})</span>
          </a>
        )}
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Sin movimientos"
          text={selected ? 'No hay movimientos de ese tipo.' : 'Aquí aparecerá cada código, canje y cambio.'}
          action={selected ? <Link href={clearHref} scroll={false} className={btnClass('ghost', 'sm') + tall}>Ver todo</Link> : undefined} />
      ) : (
        <>
          <ul aria-label="Historial de cambios" className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line/70 sm:hidden">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-navy">{auditLabel(e.action, vocab)}</span>
                  <span className="shrink-0 text-xs text-muted">{dayClock(e.at, timezone)}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted"><span className="text-navy">{who(e)}</span> · {localizeTicket(e.detail, vocab.ticket)}</p>
              </li>
            ))}
          </ul>
          <Table className="hidden sm:block">
            <caption className="sr-only">Historial de cambios</caption>
            <thead><tr><Th>Cuándo</Th><Th>Quién</Th><Th>Qué pasó</Th><Th>Detalle</Th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{dayClock(e.at, timezone)}</Td>
                  <Td className="whitespace-nowrap">{who(e)}</Td>
                  <Td className="whitespace-nowrap font-semibold">{auditLabel(e.action, vocab)}</Td>
                  <Td className="min-w-[220px] whitespace-normal text-muted">{localizeTicket(e.detail, vocab.ticket)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      {count > 0 && entries.length > 0 && (
        <nav aria-label="Páginas del historial" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>{from}–{to} de {count}</span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={pageHref(page - 1)} scroll={false} className={btnClass('ghost', 'md')} rel="prev">Anterior</Link> : null}
              <span className="inline-flex h-11 items-center px-1">Página {page} de {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} scroll={false} className={btnClass('ghost', 'md')} rel="next">Siguiente</Link> : null}
            </div>
          )}
        </nav>
      )}
    </>
  );
}
