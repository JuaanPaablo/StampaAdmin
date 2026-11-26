import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { cheapestWith, features } from '@/lib/plans';
import { campaignsRemaining, isOfferLive } from '@/lib/domain/wallet-cards';
import { pct } from '@/lib/format';
import { Card, EmptyState, PageHeader, Stat, Table, Td, Th, btnClass } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { OfferStatusBadge } from '@/components/offers/OfferStatusBadge';
import { campaignsLeftText, offerValidityLabel, plural } from '@/components/offers/offer-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cupones · Stampa' };

export default async function CuponesPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, template } = ctx;
  const f = features(business.plan);
  const [offers, stats, sentThisMonth] = await Promise.all([
    repo.listOffers(business.id),
    repo.offerStats(business.id),
    repo.countCampaignsThisMonth(business.id)
  ]);
  const now = Date.now();
  const remaining = campaignsRemaining(business.plan, sentThisMonth);
  const live = offers.filter((o) => isOfferLive(o, now)).length;
  const totals = Object.values(stats).reduce((a, s) => ({ sent: a.sent + s.sent, redeemed: a.redeemed + s.redeemed }), { sent: 0, redeemed: 0 });
  const customers = template.vocab.customers;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cupones"
        subtitle={`Crea una promoción y envíala a tus ${customers}: les llega a la tarjeta del celular y la usan una vez en ${template.vocab.counter.toLowerCase()}.`}
        actions={f.offers ? <Link href="/panel/cupones/nuevo" className={btnClass('primary')}>Crear cupón</Link> : undefined}
      />

      {!f.offers && (
        <PlanLock plan={cheapestWith((x) => x.offers) ?? 'standard'} businessName={business.name} title="Cupones en el Wallet de tus clientes"
          text={`Envía promociones que llegan al celular de tus ${customers} con un aviso, y canjéalas en caja.`} />
      )}

      {f.offers && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Envíos este mes" value={`${sentThisMonth} de ${f.pushCampaigns}`} hint={campaignsLeftText(remaining, f.pushCampaigns)} />
          <Stat label="Cupones vigentes" value={live} hint="Enviados y dentro de sus fechas" />
          <Stat label="Cupones usados" value={totals.redeemed} hint={totals.sent ? `${pct(totals.redeemed / totals.sent)} de los entregados` : 'Aún no envías cupones'} />
        </div>
      )}

      {offers.length === 0 ? (
        f.offers && (
          <EmptyState title="Aún no tienes cupones"
            text="Por ejemplo: «2x1 en capuchinos este fin de semana». Lo creas, ves cómo queda y lo envías cuando quieras."
            action={<Link href="/panel/cupones/nuevo" className={btnClass('primary')}>Crear mi primer cupón</Link>} />
        )
      ) : (
        <section aria-labelledby="lista-cupones" className="flex flex-col gap-3">
          <h2 id="lista-cupones" className="font-display text-lg font-bold text-navy">Tus cupones</h2>
          {!f.offers && <p className="text-sm text-muted">Los cupones que ya enviaste se siguen canjeando en caja hasta que venzan.</p>}
          <Table label="Lista de cupones">
            <thead>
              <tr><Th>Cupón</Th><Th>Estado</Th><Th>Vigencia</Th><Th className="text-right">Entregados</Th><Th className="text-right">Usados</Th></tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                const s = stats[o.id];
                return (
                  <tr key={o.id}>
                    <Td>
                      <Link href={`/panel/cupones/${o.id}`} className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
                        {o.title}
                      </Link>
                    </Td>
                    <Td><OfferStatusBadge offer={o} now={now} /></Td>
                    <Td className="whitespace-nowrap text-sm">{offerValidityLabel(o, now).replace(/^Válido /, '')}</Td>
                    <Td className="text-right">{o.status === 'draft' ? '—' : s?.sent ?? 0}</Td>
                    <Td className="whitespace-nowrap text-right">{o.status === 'draft' || !s?.sent ? '—' : `${s.redeemed} · ${pct(s.rate)}`}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}

      {f.offers && (
        <Card className="bg-surface shadow-none ring-0">
          <h2 className="font-display text-base font-semibold text-navy">Cómo funciona</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-navy">
            <li>Creas el cupón y lo revisas en la vista previa. Guardarlo no lo envía.</li>
            <li>Lo envías: llega a la tarjeta de todos tus {customers} registrados y, a quienes la tienen en su celular, les avisa.</li>
            <li>En {template.vocab.counter.toLowerCase()} escanean su código y queda usado. Cada persona lo usa una sola vez.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">Tu plan permite {plural(f.pushCampaigns, 'envío', 'envíos')} al mes. Crear borradores no cuenta.</p>
        </Card>
      )}
    </div>
  );
}
