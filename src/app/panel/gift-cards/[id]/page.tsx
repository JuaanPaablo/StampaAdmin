import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { features } from '@/lib/plans';
import { formatCents, GIFT_CARD_MAX_CENTS, GIFT_CARD_NOTE_MAX } from '@/lib/domain/wallet-cards';
import { dateShort, dateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Badge, Card, PageHeader, Table, Td, Th } from '@/components/ui';
import { ActionForm, FormField } from '@/components/shell/action-form';
import { ConfirmAction } from '@/components/offers/ConfirmAction';
import { GiftCodeDisplay } from '@/components/giftcards/GiftCodeDisplay';
import { MOVEMENT_LABEL } from '@/components/giftcards/gift-format';
import { giftQrSvg } from '@/components/giftcards/qr';
import { topupGiftCardAction, voidGiftCardAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gift card · Stampa' };

export default async function GiftCardPage({ params }: { params: { id: string } }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, template } = ctx;
  const card = await repo.getGiftCard(business.id, params.id);
  if (!card) notFound();
  const [movements, staff, locations, customer, qrSvg] = await Promise.all([
    repo.listGiftCardMovements(business.id, card.id),
    repo.listStaff(business.id),
    repo.listLocations(business.id),
    card.customerId ? repo.getCustomerDetail(business.id, card.customerId).then((d) => d?.customer ?? null).catch(() => null) : Promise.resolve(null),
    giftQrSvg(card.code)
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const active = card.status === 'active';
  const canTopup = active && features(business.plan).giftCards && card.balanceCents < GIFT_CARD_MAX_CENTS;
  const room = GIFT_CARD_MAX_CENTS - card.balanceCents;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta de navegación" className="-mb-3 text-sm">
        <Link href="/panel/gift-cards" className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
          <span aria-hidden>←</span> Gift Cards
        </Link>
      </nav>
      <PageHeader title={`Gift card de ${formatCents(card.balanceCents)}`}
        subtitle={`Vendida el ${dateShort(card.createdAt)} por ${formatCents(card.initialCents)}`}
        actions={active ? <Badge tone="ok">Activa</Badge> : <Badge tone="bad">Anulada</Badge>} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="flex flex-col gap-4">
          {active
            ? <GiftCodeDisplay code={card.code} qrSvg={qrSvg} balanceCents={card.balanceCents} businessName={business.name} customerName={customer?.name} />
            : <p className="rounded-xl bg-[#FBE0DE] px-4 py-3 text-sm text-[#9B2A22]">Esta gift card está anulada: ya no se puede usar ni recargar.</p>}
          <Card>
            <h2 className="font-display text-base font-semibold text-navy">{template.vocab.customer.charAt(0).toUpperCase() + template.vocab.customer.slice(1)}</h2>
            {customer
              ? <p className="mt-1 text-sm"><Link href={`/panel/clientes/${customer.id}`} className="inline-flex min-h-[44px] items-center font-semibold text-navy underline underline-offset-4">{customer.name}</Link> <span className="text-muted">· {customer.contact}</span></p>
              : <p className="mt-1 text-sm text-muted">Sin asignar. Se usa solo con el código o el QR.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {canTopup && (
            <Card>
              <h2 className="font-display text-base font-semibold text-navy">Recargar saldo</h2>
              <p className="mt-1 text-sm text-muted">Cobra el monto y regístralo aquí. Puedes recargar hasta {formatCents(room)}.</p>
              <ActionForm action={topupGiftCardAction} submitLabel="Recargar" pendingLabel="Recargando…" resetOnSuccess idempotent className="mt-3">
                <input type="hidden" name="id" value={card.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField name="amount" label="Monto (US$)" placeholder="Ej. 10" required />
                  <FormField name="note" label="Nota (opcional)" maxLength={GIFT_CARD_NOTE_MAX} />
                </div>
              </ActionForm>
            </Card>
          )}
          {active && !features(business.plan).giftCards && (
            <p className="rounded-xl bg-[#FFF3CC] px-4 py-3 text-sm text-[#7A5A00]">Se sigue cobrando en caja. Para recargarla necesitas el plan Pro.</p>
          )}

          <section aria-labelledby="movimientos" className="flex flex-col gap-3">
            <h2 id="movimientos" className="font-display text-lg font-bold text-navy">Movimientos</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-muted">Sin movimientos.</p>
            ) : (
              <Table label="Movimientos de la gift card">
                <thead>
                  <tr><Th>Fecha</Th><Th>Qué pasó</Th><Th>Quién</Th><Th className="text-right">Monto</Th><Th className="text-right">Saldo</Th></tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <Td className="whitespace-nowrap">{dateTime(m.createdAt)}</Td>
                      <Td>
                        <span className="font-semibold">{MOVEMENT_LABEL[m.kind]}</span>
                        {m.note && <span className="block text-xs text-muted">{m.note}</span>}
                      </Td>
                      <Td className="text-sm">
                        {(m.staffId && staffName.get(m.staffId)) || '—'}
                        {m.locationId && locName.get(m.locationId) && <span className="block text-xs text-muted">{locName.get(m.locationId)}</span>}
                      </Td>
                      <Td className={cn('whitespace-nowrap text-right font-semibold', m.amountCents < 0 ? 'text-bad' : 'text-[#12683F]')}>
                        {m.amountCents > 0 ? '+' : ''}{formatCents(m.amountCents)}
                      </Td>
                      <Td className="whitespace-nowrap text-right">{formatCents(m.balanceAfterCents)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>

          {active && (
            <Card>
              <h2 className="font-display text-base font-semibold text-navy">Anular gift card</h2>
              <p className="mt-1 text-sm text-muted">Úsalo si se vendió por error o si la perdieron y ya le diste una nueva.</p>
              <div className="mt-3">
                <ConfirmAction action={voidGiftCardAction} fields={{ id: card.id }} idempotent label="Anular gift card" title="¿Anular esta gift card?"
                  confirmLabel="Sí, anular" pendingLabel="Anulando…">
                  <p>El saldo de {formatCents(card.balanceCents)} queda en $0,00 y ya no se podrá usar. No se puede deshacer.</p>
                  <p>Si hay que devolver dinero, hazlo aparte.</p>
                </ConfirmAction>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
