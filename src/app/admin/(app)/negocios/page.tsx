import Link from 'next/link';
import { Card, EmptyState, PageHeader, Table, Td, Th, btnClass, inputClass } from '@/components/ui';
import { ExpiryText, StatusBadge } from '@/components/admin/StatusBadge';
import { STATUS_FILTERS, displayName, filterRows, parseSearch, parseStatusFilter } from '@/components/admin/helpers';
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

  return (
    <>
      <PageHeader
        title="Negocios"
        subtitle={filtered ? `${num(rows.length)} de ${num(all.length)} negocios.` : `${num(all.length)} negocios.`}
        actions={<Link href="/admin/negocios/nuevo" className={btnClass('primary')}>Dar acceso a un negocio</Link>}
      />

      <form method="get" role="search" className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-semibold tracking-wide text-muted">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Ej.: panadería o dueño@correo.com" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-52">
          <label htmlFor="estado" className="text-xs font-semibold tracking-wide text-muted">Estado</label>
          <select id="estado" name="estado" defaultValue={estado} className={inputClass + ' pr-8'}>
            {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={btnClass('dark') + ' flex-1 sm:flex-none'}>Buscar</button>
          {filtered && <Link href="/admin/negocios" className={btnClass('ghost') + ' flex-1 sm:flex-none'}>Limpiar</Link>}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No hay negocios con ese filtro' : 'Aún no hay negocios'}
          text={filtered ? 'Prueba con otra búsqueda o con otro estado.' : 'Da acceso al primer dueño para empezar.'}
          action={!filtered ? <Link href="/admin/negocios/nuevo" className={btnClass('primary', 'sm') + ' mt-2'}>Dar acceso a un negocio</Link> : undefined}
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
