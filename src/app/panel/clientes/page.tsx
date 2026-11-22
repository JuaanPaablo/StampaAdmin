import { features } from '@/lib/plans';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import type { CustomerQuery, CustomerSegment } from '@/lib/contracts';
import { ago, num } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, EmptyState, Input, Meter, PageHeader, Select, Table, Td, Th, btnClass } from '@/components/ui';
import { NewCustomerForm, SegmentBadge, SEGMENTS, SEGMENT_KEYS, SORTS, birthdayLabel, contactLabel } from '@/components/customers';
import { cap } from '@/components/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes · Stampa' };
const PAGE_SIZE = 25;

type SP = { q?: string; segmento?: string; orden?: string; pagina?: string };

function href(p: { q?: string; segmento?: string; orden?: string; pagina?: number }, base = '/panel/clientes') {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  if (p.segmento && p.segmento !== 'todos') u.set('segmento', p.segmento);
  if (p.orden && p.orden !== 'recientes') u.set('orden', p.orden);
  if (p.pagina && p.pagina > 1) u.set('pagina', String(p.pagina));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

export default async function ClientesPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, program, template } = ctx;
  const v = template.vocab;
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const segmento = (SEGMENT_KEYS as string[]).includes(searchParams.segmento ?? '') ? (searchParams.segmento as CustomerSegment) : 'todos';
  const orden = (SORTS.find((s) => s.key === searchParams.orden)?.key ?? 'recientes') as NonNullable<CustomerQuery['sort']>;

  // Una sola consulta con búsqueda y orden; el segmento y los conteos se calculan aquí.
  const all = await repo.listCustomers(business.id, { search: q || undefined, segment: 'todos', sort: orden });
  const counts: Record<string, number> = { todos: all.length };
  for (const s of SEGMENT_KEYS) counts[s] = all.filter((c) => c.segment === s).length;
  const filtered = segmento === 'todos' ? all : all.filter((c) => c.segment === segmento);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(searchParams.pagina) || 1)));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const now = Date.now();
  const required = program.stampsRequired;
  const canFilterExport = features(business.plan).exportCsv;
  const exportHref = canFilterExport ? href({ q, segmento, orden }, '/panel/clientes/exportar') : '/panel/clientes/exportar';

  const chips = [{ key: 'todos', label: 'Todos' }, ...SEGMENTS.map((s) => ({ key: s.key, label: s.label }))];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={cap(v.customers)}
        subtitle={`${num(counts.todos)} ${counts.todos === 1 ? v.customer : v.customers} en ${business.name}.`}
        actions={<a href={exportHref} className={btnClass('ghost')} title={canFilterExport ? undefined : 'Descarga la lista completa. Exportar con filtros es del plan Standard.'}>Exportar CSV</a>}
      />
      <NewCustomerForm customerLabel={v.customer} />

      <form method="get" action="/panel/clientes" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {segmento !== 'todos' && <input type="hidden" name="segmento" value={segmento} />}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-semibold tracking-wide text-muted">Buscar por nombre o contacto</label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Ana, 0991234567, ana@correo.com" autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor="orden" className="text-xs font-semibold tracking-wide text-muted">Ordenar por</label>
          <Select id="orden" name="orden" defaultValue={orden}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </div>
        <Button type="submit" variant="dark">Buscar</Button>
      </form>

      <nav aria-label="Filtrar por segmento" className="-mx-1 flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = c.key === segmento;
          return (
            <Link key={c.key} href={href({ q, segmento: c.key, orden })} aria-current={active ? 'true' : undefined}
              className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-inset transition',
                active ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
              {c.label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] tabular-nums', active ? 'bg-white/20' : 'bg-surface text-muted')}>{num(counts[c.key])}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={all.length === 0 && !q ? `Aún no tienes ${v.customers}` : 'No encontramos resultados'}
          text={all.length === 0 && !q
            ? `Registra a tu primer ${v.customer} con el botón de arriba, o entrega un código en ${v.counter.toLowerCase()} y se registrará solo.`
            : 'Prueba con otro nombre, quita el filtro de segmento o busca solo una parte del contacto.'}
          action={(q || segmento !== 'todos') ? <Link href="/panel/clientes" className={btnClass('ghost', 'sm')}>Quitar filtros</Link> : undefined}
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <Table>
              <caption className="sr-only">Lista de {v.customers}, página {page} de {pages}</caption>
              <thead>
                <tr>
                  <Th>{cap(v.customer)}</Th>
                  <Th>Segmento</Th>
                  <Th>Sellos</Th>
                  <Th>Última {v.visit}</Th>
                  <Th className="text-right">Canjes</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/panel/clientes/${c.id}`} className="font-semibold text-navy underline-offset-2 hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted">{contactLabel(c.contactKind)}: {c.contact}</div>
                      {birthdayLabel(c) && <div className="text-xs text-muted">Cumpleaños: {birthdayLabel(c)}</div>}
                    </Td>
                    <Td><SegmentBadge segment={c.segment} /></Td>
                    <Td className="w-48">
                      <div className="mb-1 text-xs text-muted">{c.stamps} de {required}</div>
                      <Meter value={c.stamps / required} tone={c.stamps >= required ? 'sun' : 'navy'} />
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{c.lastVisitAt ? ago(c.lastVisitAt, now) : 'Sin ' + v.visits}</Td>
                    <Td className="text-right">{c.rewardsRedeemed}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 sm:hidden" aria-label={`Lista de ${v.customers}`}>
            {rows.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/panel/clientes/${c.id}`} className="block truncate font-semibold text-navy underline-offset-2 hover:underline">{c.name}</Link>
                    <p className="truncate text-xs text-muted">{contactLabel(c.contactKind)}: {c.contact}</p>
                    {birthdayLabel(c) && <p className="truncate text-xs text-muted">Cumpleaños: {birthdayLabel(c)}</p>}
                  </div>
                  <SegmentBadge segment={c.segment} />
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted"><span>{c.stamps} de {required} sellos</span><span>{c.rewardsRedeemed} canjes</span></div>
                  <Meter value={c.stamps / required} tone={c.stamps >= required ? 'sun' : 'navy'} />
                </div>
                <p className="mt-2 text-xs text-muted">Última {v.visit}: {c.lastVisitAt ? ago(c.lastVisitAt, now) : 'sin ' + v.visits}</p>
              </li>
            ))}
          </ul>

          <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <p>Mostrando {from} a {from + rows.length - 1} de {num(filtered.length)}</p>
            <div className="flex gap-2">
              {page > 1 ? <Link href={href({ q, segmento, orden, pagina: page - 1 })} className={btnClass('ghost', 'sm')} rel="prev">Anterior</Link> : null}
              <span className="inline-flex h-9 items-center px-2">Página {page} de {pages}</span>
              {page < pages ? <Link href={href({ q, segmento, orden, pagina: page + 1 })} className={btnClass('ghost', 'sm')} rel="next">Siguiente</Link> : null}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
