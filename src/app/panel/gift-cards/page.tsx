import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { cheapestWith, features } from '@/lib/plans';
import { formatCents, maskGiftCardCode } from '@/lib/domain/wallet-cards';
import { dateShort } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Badge, Button, EmptyState, Input, PageHeader, Stat, Table, Td, Th, btnClass } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { filterGiftCards, giftTotals, parseGiftFilter, type GiftFilter } from '@/components/giftcards/gift-format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gift Cards · Stampa' };

const TABS: { key: GiftFilter; label: string }[] = [
  { key: 'activas', label: 'Activas' }, { key: 'anuladas', label: 'Anuladas' }, { key: 'todas', label: 'Todas' }
];

export default async function GiftCardsPage({ searchParams }: { searchParams: { estado?: string; q?: string } }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, template } = ctx;
  const f = features(business.plan);
  const [cards, customers] = await Promise.all([repo.listGiftCards(business.id), repo.listCustomers(business.id)]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const nameOf = (id?: string) => (id ? names.get(id) : undefined);
  const filter = parseGiftFilter(searchParams.estado);
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const shown = filterGiftCards(cards, { filter, q }, nameOf);
  const totals = giftTotals(cards);
  const href = (estado: GiftFilter) => {
    const p = new URLSearchParams();
    if (estado !== 'activas') p.set('estado', estado);
    if (q) p.set('q', q);
    const s = p.toString();
    return '/panel/gift-cards' + (s ? `?${s}` : '');
  };

  if (!f.giftCards && cards.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Gift Cards" subtitle="Tarjetas de regalo con saldo que tus clientes usan en caja." />
        <PlanLock plan={cheapestWith((x) => x.giftCards) ?? 'pro'} businessName={business.name} title="Gift Cards con saldo"
          text="Vende tarjetas de regalo: tus clientes las guardan en el celular y pagan con el saldo en caja." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gift Cards"
        subtitle={`Tarjetas de regalo con saldo. Tus ${template.vocab.customers} pagan con ellas en ${template.vocab.counter.toLowerCase()} escaneando el QR o dictando el código.`}
        actions={f.giftCards ? <Link href="/panel/gift-cards/vender" className={btnClass('primary')}>Vender gift card</Link> : undefined}
      />

      {!f.giftCards && (
        <PlanLock compact plan={cheapestWith((x) => x.giftCards) ?? 'pro'} businessName={business.name} title="Vender y recargar gift cards"
          text="Las que ya vendiste se siguen cobrando en caja, pero para vender o recargar necesitas el plan Pro." />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Saldo pendiente total" value={formatCents(totals.liabilityCents)} hint="Lo que aún pueden gastar en tu negocio" />
        <Stat label="Gift cards activas" value={totals.activeCount} />
        <Stat label="Anuladas" value={totals.voidCount} />
      </div>

      {cards.length === 0 ? (
        <EmptyState title="Aún no vendes gift cards" text="Son ideales para regalos: el cliente paga ahora y quien la recibe la usa cuando quiera."
          action={<Link href="/panel/gift-cards/vender" className={btnClass('primary')}>Vender la primera</Link>} />
      ) : (
        <section aria-labelledby="lista-gift" className="flex flex-col gap-3">
          <h2 id="lista-gift" className="sr-only">Lista de gift cards</h2>
          <form method="get" action="/panel/gift-cards" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {filter !== 'activas' && <input type="hidden" name="estado" value={filter} />}
            <label htmlFor="q" className="sr-only">Buscar por código o {template.vocab.customer}</label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder={`Buscar por código o ${template.vocab.customer}`} autoComplete="off" enterKeyHint="search" className="min-w-0 sm:flex-1" />
            <Button type="submit" variant="dark">Buscar</Button>
          </form>
          <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Link key={t.key} href={href(t.key)} aria-current={filter === t.key ? 'page' : undefined}
                className={cn('inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60 sm:h-9',
                  filter === t.key ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
                {t.label}
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <EmptyState title="No hay gift cards con ese filtro" text={q ? 'Prueba con otra parte del código o del nombre.' : undefined}
              action={q ? <Link href={href(filter)} className={btnClass('ghost')}>Quitar búsqueda</Link> : undefined} />
          ) : (
            <Table label="Gift cards">
              <thead>
                <tr><Th>Código</Th><Th>{template.vocab.customer.charAt(0).toUpperCase() + template.vocab.customer.slice(1)}</Th><Th>Vendida</Th><Th>Estado</Th><Th className="text-right">Saldo</Th></tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/panel/gift-cards/${c.id}`} className="inline-flex min-h-[44px] items-center whitespace-nowrap font-mono font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
                        {maskGiftCardCode(c.code)}<span className="sr-only">, ver detalle</span>
                      </Link>
                    </Td>
                    <Td>{nameOf(c.customerId) ?? <span className="text-muted">Sin asignar</span>}</Td>
                    <Td className="whitespace-nowrap">{dateShort(c.createdAt)} · {formatCents(c.initialCents)}</Td>
                    <Td>{c.status === 'active' ? <Badge tone="ok">Activa</Badge> : <Badge tone="bad">Anulada</Badge>}</Td>
                    <Td className="text-right font-semibold">{formatCents(c.balanceCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
