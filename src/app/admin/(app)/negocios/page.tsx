import Link from 'next/link';
import { Card, EmptyState, PageHeader, Table, Td, Th, btnClass, inputClass } from '@/components/ui';
import { ExpiryText, StatusBadge } from '@/components/admin/StatusBadge';
import { STATUS_FILTERS, displayName, filterRows, parseSearch, parseStatusFilter, type StatusFilter } from '@/components/admin/helpers';
import { requireAdmin } from '@/lib/admin-session';
import { ago, num } from '@/lib/format';
import { PLAN_LABEL } from '@/lib/mvp-rules';

export const dynamic = 'force-dynamic';

export default async function AdminBusinessesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { repo } = await requireAdmin();
  const q = parseSearch(searchParams?.q);
  const estado = parseStatusFilter(searchParams?.estado);
  const all = await repo.listAdminBusinesses();
  const now = Date.now();
  const rows = filterRows(all, q, estado, now);
  const filtered = q !== '' || estado !== 'todos';
  const counts = Object.fromEntries(STATUS_FILTERS.map((f) => [f.value, filterRows(all, q, f.value, now).length])) as Record<StatusFilter, number>;

  return (
    <>
      <PageHeader
        title="Negocios"
        subtitle={`${num(all.length)} ${all.length === 1 ? 'negocio' : 'negocios'}`}
        actions={<Link href="/admin/negocios/nuevo" className={btnClass('primary')}>Dar acceso a un negocio</Link>}
      />

      <form method="get" role="search" className="mb-3 flex gap-2">
        {estado !== 'todos' && <input type="hidden" name="estado" value={estado} />}
        <label htmlFor="q" className="sr-only">Buscar por negocio, dueño o correo</label>
        <input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Buscar negocio o correo" className={inputClass + ' min-w-0 flex-1'} />
        <button type="submit" className={btnClass('dark') + ' shrink-0'}>Buscar</button>
      </form>

      {/* Filtros rápidos por estado, con cuántos hay en cada uno (respetan la búsqueda) */}
      <nav aria-label="Filtrar por estado" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const on = f.value === estado;
            const count = counts[f.value];
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (f.value !== 'todos') params.set('estado', f.value);
            const href = '/admin/negocios' + (params.toString() ? `?${params}` : '');
            return (
              <li key={f.value}>
                <Link
                  href={href} aria-current={on ? 'page' : undefined}
                  className={'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy ' +
                    (on ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}
                >
                  {f.label}
                  <span className={'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums leading-none ' + (on ? 'bg-white/15 text-white' : 'bg-surface text-muted')}>{num(count)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {filtered && rows.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          {num(rows.length)} de {num(all.length)}{q && <> · «{q}»</>}{' '}
          <Link href="/admin/negocios" className="-my-3 inline-block py-3 font-semibold text-navy underline underline-offset-2">Quitar filtros</Link>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No hay negocios con ese filtro' : 'Aún no hay negocios'}
          text={filtered ? 'Prueba con otra búsqueda o con otro estado.' : 'Da acceso al primer dueño para empezar.'}
          action={filtered
            ? <Link href="/admin/negocios" className={btnClass('ghost') + ' mt-2'}>Quitar filtros</Link>
            : <Link href="/admin/negocios/nuevo" className={btnClass('primary') + ' mt-2'}>Dar acceso a un negocio</Link>}
        />
      ) : (
        <>
          {/* Escritorio y tableta: tabla */}
          <div className="hidden md:block">
            <Table className="[&_table]:min-w-[880px]">
              <thead>
                <tr><Th>Negocio</Th><Th>Estado</Th><Th>Plan</Th><Th>Vencimiento</Th><Th className="text-right">Clientes</Th><Th className="text-right">Sellos 30 d</Th><Th>Última actividad</Th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.business.id} className="hover:bg-surface/70">
                    <Td className="max-w-[280px]">
                      <Link href={`/admin/negocios/${r.business.id}`} className="block truncate font-semibold text-navy underline-offset-2 hover:underline">{displayName(r.business)}</Link>
                      <span className="block truncate text-xs text-muted">{r.owner?.email ?? 'Sin dueño con correo'}{r.owner?.invitePending ? ' · invitación pendiente' : ''}</span>
                    </Td>
                    <Td><StatusBadge business={r.business} /></Td>
                    <Td>{PLAN_LABEL[r.business.plan]}</Td>
                    <Td><ExpiryText planExpiresAt={r.business.planExpiresAt} autoRenew={r.business.autoRenew} now={now} /></Td>
                    <Td className="text-right">{num(r.stats.customers)}</Td>
                    <Td className="text-right">{num(r.stats.stamps30d)}</Td>
                    <Td className="whitespace-nowrap text-muted">{r.stats.lastActivityAt ? ago(r.stats.lastActivityAt, now) : 'Sin actividad'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.business.id}>
                <Link href={`/admin/negocios/${r.business.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
                  <Card as="div" className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy">{displayName(r.business)}</p>
                        <p className="truncate text-xs text-muted">{r.owner?.email ?? 'Sin dueño con correo'}</p>
                      </div>
                      <StatusBadge business={r.business} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-navy">
                      <span>Plan {PLAN_LABEL[r.business.plan]}</span>
                      <ExpiryText planExpiresAt={r.business.planExpiresAt} autoRenew={r.business.autoRenew} now={now} />
                    </div>
                    <p className="text-xs text-muted">
                      {num(r.stats.customers)} clientes · {num(r.stats.stamps30d)} sellos en 30 días · {r.stats.lastActivityAt ? ago(r.stats.lastActivityAt, now) : 'sin actividad'}
                      {r.owner?.invitePending ? ' · invitación pendiente' : ''}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
