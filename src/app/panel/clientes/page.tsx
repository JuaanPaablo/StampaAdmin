import { features } from '@/lib/plans';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import type { CustomerQuery, CustomerSegment } from '@/lib/contracts';
import { ago, num } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, EmptyState, Input, Meter, PageHeader, Table, Td, Th, btnClass } from '@/components/ui';
import { NewCustomerForm, SegmentBadge, SEGMENTS, SEGMENT_KEYS, SORTS, birthdayLabel, contactLabel, segmentInfo } from '@/components/customers';
import { AutoSubmitSelect } from '@/components/customers/AutoSubmitSelect';
import { detailHref, listHref as href } from '@/components/customers/list-href';
import { cap } from '@/components/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes · Stampa' };
const PAGE_SIZE = 25;
/** Objetivo táctil de 44 px en botones pequeños (btnClass 'sm' mide 36 px). */
const TAP = 'min-h-[44px]';

type SP = { q?: string; segmento?: string; orden?: string; pagina?: string };

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
  const hasFilters = !!q || segmento !== 'todos' || orden !== 'recientes';
  const narrowed = !!q || segmento !== 'todos';
  const canFilterExport = features(business.plan).exportCsv;
  const exportHref = canFilterExport ? href({ q, segmento, orden }, '/panel/clientes/exportar') : '/panel/clientes/exportar';
  // Sin el plan, con filtros activos se descarga la lista completa: el botón lo dice en vez de esconderlo en un title.
  const exportLabel = !hasFilters ? 'Exportar CSV' : canFilterExport ? 'Exportar resultados' : 'Exportar todo';
  const seg = segmento === 'todos' ? null : segmentInfo(segmento);
  const back = { q, segmento, orden, pagina: page };

  const chips = [{ key: 'todos', label: 'Todos' }, ...SEGMENTS.map((s) => ({ key: s.key, label: s.label }))];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={cap(v.customers)}
        actions={
          <a href={exportHref} download className={btnClass('ghost')}
            title={!canFilterExport && hasFilters ? 'Exportar solo los resultados filtrados es del plan Standard.' : undefined}>
            {exportLabel}
          </a>
        }
      />
      <NewCustomerForm customerLabel={v.customer} />

      <form method="get" action="/panel/clientes" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {segmento !== 'todos' && <input type="hidden" name="segmento" value={segmento} />}
        <label htmlFor="q" className="sr-only">Buscar por nombre, teléfono o correo</label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar nombre, teléfono o correo" autoComplete="off" enterKeyHint="search" className="min-w-0 sm:flex-1" />
        <div className="flex gap-2 sm:gap-3">
          <label htmlFor="orden" className="sr-only">Ordenar por</label>
          <AutoSubmitSelect id="orden" name="orden" defaultValue={orden} className="min-w-0 flex-1 sm:w-56 sm:flex-none">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </AutoSubmitSelect>
          <Button type="submit" variant="dark">Buscar</Button>
        </div>
      </form>

      <nav aria-label="Filtrar por segmento" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {chips.map((c) => {
          const active = c.key === segmento;
          return (
            <Link key={c.key} href={href({ q, segmento: c.key, orden })} aria-current={active ? 'true' : undefined}
              className={cn('inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60 sm:h-9',
                active ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
              {c.label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] tabular-nums', active ? 'bg-white/20' : 'bg-surface text-muted')}>{num(counts[c.key])}</span>
            </Link>
          );
        })}
      </nav>

      {/* Estado de la lista: cuántos, con qué filtros y cómo quitarlos. Se anuncia al cambiar de filtro. */}
      {all.length > 0 || q ? (
        <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <p role="status" aria-live="polite">
            <span className="font-semibold text-navy">{num(filtered.length)}</span> {filtered.length === 1 ? v.customer : v.customers}
            {q && <> con «<span className="text-navy">{q}</span>»</>}
            {seg && <> · {seg.label}</>}
          </p>
          {narrowed && rows.length > 0 && (
            <Link href={href({ orden })} className={cn('inline-flex items-center font-semibold text-navy underline underline-offset-4', TAP, 'sm:min-h-0')}>
              Quitar filtros
            </Link>
          )}
          {seg && rows.length > 0 && <p className="w-full text-xs">{seg.hint}</p>}
        </div>
      ) : null}

      {rows.length === 0 ? (
        all.length === 0 && !q ? (
          <EmptyState
            title={`Aún no tienes ${v.customers}`}
            text={`Se registran solos al recibir su primer sello. También puedes agregarlos con «Nuevo ${v.customer}».`}
          />
        ) : (
          <EmptyState
            title={q ? `Nadie coincide con «${q}»` : `No hay ${v.customers} en «${seg?.label ?? ''}»`}
            text={q ? 'Revisa cómo está escrito o busca por teléfono o correo.' : seg?.hint}
            action={<Link href={href({ orden })} className={cn(btnClass('ghost', 'sm'), TAP)}>Ver todos</Link>}
          />
        )
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
                  <Th className="text-right">Premios canjeados</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={detailHref(c.id, back)} className="font-semibold text-navy underline-offset-2 hover:underline focus-visible:underline">{c.name}</Link>
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

          <ul className="flex flex-col gap-2 sm:hidden" aria-label={`Lista de ${v.customers}`}>
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={detailHref(c.id, back)} className="block rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-line/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60 active:bg-surface">
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-navy">{c.name}</span>
                    <SegmentBadge segment={c.segment} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{c.contact}</span>
                  <span className="mt-2.5 flex items-center gap-3 text-xs text-muted">
                    <span className="min-w-0 flex-1"><Meter value={c.stamps / required} tone={c.stamps >= required ? 'sun' : 'navy'} /></span>
                    <span className="shrink-0 tabular-nums"><span className="sr-only">Sellos: </span>{c.stamps}/{required}</span>
                    <span className="shrink-0">{c.lastVisitAt ? ago(c.lastVisitAt, now) : 'sin ' + v.visits}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <p>{from}–{from + rows.length - 1} de {num(filtered.length)}</p>
              <div className="flex items-center gap-2">
                {page > 1 ? <Link href={href({ q, segmento, orden, pagina: page - 1 })} className={cn(btnClass('ghost', 'sm'), TAP)} rel="prev">Anterior</Link> : null}
                <span className="inline-flex items-center px-2" aria-current="page">Página {page} de {pages}</span>
                {page < pages ? <Link href={href({ q, segmento, orden, pagina: page + 1 })} className={cn(btnClass('ghost', 'sm'), TAP)} rel="next">Siguiente</Link> : null}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
