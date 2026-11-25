import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, EmptyState, PageHeader, Table, Td, Th, btnClass, inputClass } from '@/components/ui';
import { ExpiryText, StatusBadge } from '@/components/admin/StatusBadge';
import { HealthBadge } from '@/components/admin/business/HealthBadge';
import {
  HEALTH_FILTERS, SORT_DEFAULT_DIR, SORT_OPTIONS, STATUS_FILTERS, applyListFilters, displayName, lastStampText, listQuery,
  parseListParams, rowHealth, sortRows, type HealthFilter, type ListParams, type SortKey, type StatusFilter
} from '@/components/admin/helpers';
import { requireAdmin } from '@/lib/admin-session';
import { formatEcPhone } from '@/lib/phone';
import { num } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PLANS, PLAN_LABEL } from '@/lib/mvp-rules';
import type { BusinessHealth } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

const BASE = '/admin/negocios';

const chipClass = (on: boolean) =>
  'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy ' +
  (on ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface');

const DOT: Record<BusinessHealth, string> = { green: 'bg-[#1E9E64]', yellow: 'bg-[#B98900]', red: 'bg-bad', none: 'bg-[#9FB1C5]' };

function Chip({ href, on, count, children }: { href: string; on: boolean; count: number; children: ReactNode }) {
  return (
    <li>
      <Link href={href} aria-current={on ? 'page' : undefined} className={chipClass(on)}>
        {children}
        <span className={'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums leading-none ' + (on ? 'bg-white/15 text-white' : 'bg-surface text-muted')}>{num(count)}</span>
      </Link>
    </li>
  );
}

/** Encabezado de columna ordenable: enlace (funciona sin JS) y aria-sort en la columna activa. */
function SortTh({ p, k, children, className }: { p: ListParams; k: SortKey; children: ReactNode; className?: string }) {
  const active = p.orden === k;
  const nextDir = active ? (p.dir === 'asc' ? 'desc' : 'asc') : SORT_DEFAULT_DIR[k];
  const right = className?.includes('text-right');
  return (
    <th aria-sort={active ? (p.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('whitespace-nowrap border-b border-line px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted', className)}>
      <Link href={BASE + listQuery(p, { orden: k, dir: nextDir })} scroll={false}
        className={cn('inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy', right && 'flex-row-reverse', active && 'text-navy')}>
        <span>{children}</span>
        <span aria-hidden="true" className={cn('text-[10px]', !active && 'opacity-40')}>{active ? (p.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
        <span className="sr-only">
          {active ? `, ordenado ${p.dir === 'asc' ? 'de menor a mayor' : 'de mayor a menor'}. Cambiar orden` : ', ordenar por esta columna'}
        </span>
      </Link>
    </th>
  );
}

export default async function AdminBusinessesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { repo } = await requireAdmin();
  const p = parseListParams(searchParams);
  const all = await repo.listAdminBusinesses();
  const now = Date.now();
  const rows = sortRows(applyListFilters(all, p, now), p.orden, p.dir);
  const filtered = p.q !== '' || p.estado !== 'todos' || p.salud !== 'todos' || p.plan !== 'todos';
  const statusCounts = Object.fromEntries(STATUS_FILTERS.map((f) => [f.value, applyListFilters(all, { ...p, estado: f.value }, now).length])) as Record<StatusFilter, number>;
  const healthCounts = Object.fromEntries(HEALTH_FILTERS.map((f) => [f.value, applyListFilters(all, { ...p, salud: f.value }, now).length])) as Record<HealthFilter, number>;
  const clearHref = BASE + listQuery(p, { q: '', estado: 'todos', salud: 'todos', plan: 'todos' });
  const exportHref = `${BASE}/exportar${listQuery(p)}`;

  return (
    <>
      <PageHeader
        title="Negocios"
        subtitle={`${num(all.length)} ${all.length === 1 ? 'negocio' : 'negocios'}`}
        actions={<Link href="/admin/negocios/nuevo" className={btnClass('primary')}>Dar acceso a un negocio</Link>}
      />

      {/* Búsqueda, plan y orden: formulario GET (funciona sin JavaScript). Conserva estado y actividad. */}
      <form method="get" action={BASE} role="search" className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {p.estado !== 'todos' && <input type="hidden" name="estado" value={p.estado} />}
        {p.salud !== 'todos' && <input type="hidden" name="salud" value={p.salud} />}
        <div className="col-span-2 min-w-0 sm:min-w-[240px] sm:flex-1">
          <label htmlFor="q" className="sr-only">Buscar por negocio, dueño, correo o celular</label>
          <input id="q" name="q" type="search" defaultValue={p.q} maxLength={100} placeholder="Negocio, correo o celular" className={inputClass} />
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor="plan" className="sr-only">Plan</label>
          <select id="plan" name="plan" defaultValue={p.plan} className={cn(inputClass, 'w-full pr-8 sm:w-auto')}>
            <option value="todos">Todos los planes</option>
            {PLANS.map((pl) => <option key={pl} value={pl}>Plan {PLAN_LABEL[pl]}</option>)}
          </select>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor="ordenar" className="sr-only">Ordenar por</label>
          <select id="ordenar" name="ordenar" defaultValue={`${p.orden}.${p.dir}`} className={cn(inputClass, 'w-full pr-8 sm:w-auto')}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button type="submit" className={btnClass('dark') + ' col-span-2 shrink-0 sm:col-span-1'}>Buscar</button>
      </form>

      {/* Filtros rápidos por estado y por actividad, con cuántos hay en cada uno (respetan los demás filtros) */}
      <nav aria-label="Filtrar por estado" className="-mx-4 mb-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} href={BASE + listQuery(p, { estado: f.value })} on={f.value === p.estado} count={statusCounts[f.value]}>{f.label}</Chip>
          ))}
        </ul>
      </nav>
      <nav aria-label="Filtrar por actividad" className="-mx-4 mb-4 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {HEALTH_FILTERS.map((f) => (
            <Chip key={f.value} href={BASE + listQuery(p, { salud: f.value })} on={f.value === p.salud} count={healthCounts[f.value]}>
              {f.health && <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', DOT[f.health], f.value === p.salud && 'ring-2 ring-white')} />}
              {f.label}
            </Chip>
          ))}
        </ul>
      </nav>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {filtered
            ? <>{num(rows.length)} de {num(all.length)} {all.length === 1 ? 'negocio' : 'negocios'}{p.q && <> · «{p.q}»</>}</>
            : <>{num(rows.length)} {rows.length === 1 ? 'negocio' : 'negocios'}</>}
          {filtered && <>{' '}<Link href={clearHref} className="-my-3 inline-block py-3 font-semibold text-navy underline underline-offset-2">Quitar filtros</Link></>}
        </p>
        {rows.length > 0 && (
          <a href={exportHref} className={btnClass('ghost', 'sm')}>
            <span aria-hidden="true">⤓</span> Exportar CSV
            {filtered && <span className="sr-only"> (solo los {num(rows.length)} filtrados)</span>}
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No hay negocios con esos filtros' : 'Aún no hay negocios'}
          text={filtered ? 'Prueba con otra búsqueda, otro estado u otra actividad.' : 'Da acceso al primer dueño para empezar.'}
          action={filtered
            ? <Link href={clearHref} className={btnClass('ghost') + ' mt-2'}>Quitar filtros</Link>
            : <Link href="/admin/negocios/nuevo" className={btnClass('primary') + ' mt-2'}>Dar acceso a un negocio</Link>}
        />
      ) : (
        <>
          {/* Escritorio y tableta: tabla */}
          <div className="hidden md:block">
            <Table label="Lista de negocios" className="[&_table]:min-w-[940px]">
              <thead>
                <tr>
                  <SortTh p={p} k="nombre">Negocio</SortTh>
                  <Th>Estado</Th>
                  <Th>Plan</Th>
                  <SortTh p={p} k="ultimo-sello">Actividad</SortTh>
                  <SortTh p={p} k="clientes" className="text-right">Clientes</SortTh>
                  <SortTh p={p} k="sellos30" className="text-right">Sellos 30 d</SortTh>
                  <SortTh p={p} k="vence">Vence</SortTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const h = rowHealth(r, now);
                  return (
                    <tr key={r.business.id} className="hover:bg-surface/70">
                      <Td className="max-w-[280px]">
                        <Link href={`/admin/negocios/${r.business.id}`} className="block truncate font-semibold text-navy underline-offset-2 hover:underline">{displayName(r.business)}</Link>
                        <span className="block truncate text-xs text-muted">
                          {r.owner?.email ?? 'Sin dueño con correo'}{r.owner?.invitePending ? ' · invitación pendiente' : ''}
                        </span>
                        {r.ownerPhone && <span className="block truncate text-xs text-muted">{formatEcPhone(r.ownerPhone)}</span>}
                      </Td>
                      <Td><StatusBadge business={r.business} /></Td>
                      <Td>{PLAN_LABEL[r.business.plan]}</Td>
                      <Td>
                        <HealthBadge health={h} />
                        <span className="mt-1 block whitespace-nowrap text-xs text-muted">
                          {r.stats.lastStampAt ? `Último sello ${lastStampText(r.stats.lastStampAt, now)}` : h === 'none' ? 'Sin sellos' : 'Nunca selló'}
                        </span>
                      </Td>
                      <Td className="text-right">{num(r.stats.customers)}</Td>
                      <Td className="text-right">{num(r.stats.stamps30d)}</Td>
                      <Td><ExpiryText planExpiresAt={r.business.planExpiresAt} autoRenew={r.business.autoRenew} now={now} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Lista de negocios">
            {rows.map((r) => {
              const h = rowHealth(r, now);
              return (
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
                        <HealthBadge health={h} prefix="Actividad:" detail={h !== 'none' ? (r.stats.lastStampAt ? lastStampText(r.stats.lastStampAt, now) : 'nunca selló') : undefined} />
                        <span>Plan {PLAN_LABEL[r.business.plan]}</span>
                        <ExpiryText planExpiresAt={r.business.planExpiresAt} autoRenew={r.business.autoRenew} now={now} />
                      </div>
                      <p className="text-xs text-muted">
                        {num(r.stats.customers)} {r.stats.customers === 1 ? 'cliente' : 'clientes'} · {num(r.stats.stamps30d)} sellos en 30 días
                        {r.owner?.invitePending ? ' · invitación pendiente' : ''}
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
