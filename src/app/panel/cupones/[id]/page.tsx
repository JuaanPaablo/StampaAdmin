import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { cheapestWith, features } from '@/lib/plans';
import { campaignsRemaining } from '@/lib/domain/wallet-cards';
import { ecDayKey } from '@/lib/domain/admin-insights';
import { dateTime, pct } from '@/lib/format';
import { Card, PageHeader, Stat } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { OfferForm } from '@/components/offers/OfferForm';
import { OfferPreview } from '@/components/offers/OfferPreview';
import { OfferStatusBadge } from '@/components/offers/OfferStatusBadge';
import { ConfirmAction } from '@/components/offers/ConfirmAction';
import { OfferWalletSync } from '@/components/offers/OfferWalletSync';
import { campaignsLeftText, dayLabel, offerFormDefaults, offerValidityLabel, parseSentQuery, plural, sendResultMessage, todayEc } from '@/components/offers/offer-form';
import { endOfferAction, sendOfferAction } from '../actions';

export const dynamic = 'force-dynamic';
// El Wallet de los clientes se actualiza por tandas de ~25 (OfferWalletSync → syncOfferBatchAction); cada tanda cabe
// de sobra en este tiempo.
export const maxDuration = 60;
export const metadata = { title: 'Cupón · Stampa' };

export default async function CuponPage({ params, searchParams }: { params: { id: string }; searchParams: { enviado?: string; creado?: string; wallet?: string } }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, program, template } = ctx;
  const offer = await repo.getOffer(business.id, params.id);
  if (!offer) notFound();
  const f = features(business.plan);
  const draft = offer.status === 'draft';
  const [stats, sentThisMonth, customerCount] = await Promise.all([
    draft ? Promise.resolve(null) : repo.offerStats(business.id, offer.id).then((r) => r[offer.id] ?? null),
    draft ? repo.countCampaignsThisMonth(business.id) : Promise.resolve(0),
    draft ? repo.listCustomers(business.id).then((r) => r.length) : Promise.resolve(0)
  ]);
  const now = Date.now();
  const v = template.vocab;
  const remaining = campaignsRemaining(business.plan, sentThisMonth);
  const sentResult = parseSentQuery(searchParams.enviado);
  const brand = { businessName: business.name, logoText: program.logoText, logoUrl: program.logoUrl, colors: program.colors };
  const expired = Date.parse(offer.endsAt) < now;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta de navegación" className="-mb-3 text-sm">
        <Link href="/panel/cupones" className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
          <span aria-hidden>←</span> Cupones
        </Link>
      </nav>
      <PageHeader title={offer.title} subtitle={offerValidityLabel(offer, now)} actions={<OfferStatusBadge offer={offer} now={now} />} />

      {sentResult && !draft && (
        <p role="status" className="rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">
          {sendResultMessage(sentResult, { customer: v.customer, customers: v.customers })}
        </p>
      )}
      {searchParams.creado && draft && (
        <p role="status" className="rounded-xl bg-[#E3EDF8] px-4 py-3 text-sm text-navy">
          Cupón guardado como borrador. Revísalo y, cuando esté listo, envíalo a tus {v.customers} más abajo.
        </p>
      )}

      {draft ? (
        f.offers ? (
          <>
            <Card className="sm:p-6">
              <h2 className="font-display text-lg font-bold text-navy">Editar borrador</h2>
              <div className="mt-4">
                <OfferForm offerId={offer.id} defaults={offerFormDefaults(offer, now)} today={todayEc(now)} brand={brand} />
              </div>
            </Card>

            <Card className="sm:p-6">
              <h2 className="font-display text-lg font-bold text-navy">Enviar a mis {v.customers}</h2>
              <p className="mt-1 text-sm text-muted">{campaignsLeftText(remaining, f.pushCampaigns)}</p>
              <div className="mt-4">
                {expired ? (
                  <p className="text-sm text-bad">La fecha final ya pasó. Cambia las fechas para poder enviarlo.</p>
                ) : remaining <= 0 ? (
                  <p className="rounded-xl bg-[#FFF3CC] px-4 py-3 text-sm text-[#7A5A00]">Este mes ya no te quedan envíos. Puedes dejarlo listo y enviarlo el próximo mes.</p>
                ) : customerCount === 0 ? (
                  <p className="rounded-xl bg-surface px-4 py-3 text-sm text-navy">Todavía no tienes {v.customers} registrados. Cuando se registren con tu QR podrás enviarles cupones.</p>
                ) : (
                  <ConfirmAction action={sendOfferAction} fields={{ id: offer.id }} tone="primary" openVariant="primary"
                    label={`Enviar a mis ${v.customers}`} title={`¿Enviar «${offer.title}»?`}
                    confirmLabel={`Sí, enviar a ${plural(customerCount, v.customer, v.customers)}`} pendingLabel="Enviando…"
                    onSuccessHref={`/panel/cupones/${offer.id}`}>
                    <p>Lo recibirán <strong>{plural(customerCount, v.customer, v.customers)}</strong> en su tarjeta. A quienes la tienen en el celular les llegará un aviso.</p>
                    <p>Usarás 1 de tus envíos del mes: {remaining === 1 ? 'después no te quedará ninguno' : `te quedarán ${remaining - 1}`}.</p>
                    <p>Después de enviarlo ya no se puede editar.</p>
                  </ConfirmAction>
                )}
              </div>
            </Card>
          </>
        ) : (
          <>
            <PlanLock plan={cheapestWith((x) => x.offers) ?? 'standard'} businessName={business.name} title="Enviar cupones"
              text="Tu plan actual no permite editar ni enviar cupones." />
            <OfferPreview {...brand} title={offer.title} description={offer.description} terms={offer.terms} imageUrl={offer.imageUrl} validity={offerValidityLabel(offer, now)} />
          </>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Entregados" value={stats?.sent ?? 0} hint={offer.sentAt ? `Enviado el ${dateTime(offer.sentAt)}` : undefined} />
              <Stat label="Usados" value={stats?.redeemed ?? 0} />
              <Stat label="Tasa de uso" value={stats?.sent ? pct(stats.rate) : '—'} hint="Usados de cada 100 entregados" />
            </div>
            <Card>
              <h2 className="font-display text-base font-semibold text-navy">Celulares de tus {v.customers}</h2>
              <p className="mt-1 text-sm text-muted">
                {offer.status === 'sent' && !expired
                  ? `Actualiza el cupón en Google Wallet y Apple Wallet. A quien todavía no recibió el aviso de este cupón le llega uno (máximo 3 avisos al día por persona).`
                  : 'Actualiza los cupones sin usar en Google Wallet y Apple Wallet para que aparezcan terminados. No envía avisos.'}
              </p>
              <div className="mt-3">
                <OfferWalletSync offerId={offer.id} mode={offer.status === 'sent' && !expired ? 'send' : 'end'}
                  autoStart={searchParams.wallet === 'envio' || searchParams.wallet === 'fin'} words={{ customer: v.customer, customers: v.customers }} />
              </div>
            </Card>
            {offer.status === 'sent' && !expired && (
              <Card>
                <h2 className="font-display text-base font-semibold text-navy">Terminar cupón</h2>
                <p className="mt-1 text-sm text-muted">Si se acabó la promoción antes de tiempo, termínalo: ya no se podrá usar en {v.counter.toLowerCase()}.</p>
                <div className="mt-3">
                  <ConfirmAction action={endOfferAction} fields={{ id: offer.id }} label="Terminar cupón" title="¿Terminar este cupón?"
                    confirmLabel="Sí, terminar" pendingLabel="Terminando…" onSuccessHref={`/panel/cupones/${offer.id}`}>
                    <p>Nadie más podrá usarlo, ni siquiera quienes ya lo tienen. No se puede deshacer.</p>
                  </ConfirmAction>
                </div>
              </Card>
            )}
            {offer.status === 'ended' && <p className="text-sm text-muted">Este cupón está terminado: ya no se puede usar.</p>}
            {offer.status === 'sent' && expired && <p className="text-sm text-muted">Este cupón venció el {dayLabel(ecDayKey(offer.endsAt), now)}.</p>}
          </div>
          <OfferPreview {...brand} title={offer.title} description={offer.description} terms={offer.terms} imageUrl={offer.imageUrl} validity={offerValidityLabel(offer, now)} />
        </div>
      )}
    </div>
  );
}
