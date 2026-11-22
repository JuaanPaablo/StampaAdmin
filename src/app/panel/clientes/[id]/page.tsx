import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { ago, dateShort, dateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { lcfirst, nextReward, pendingRewards } from '@/lib/rewards';
import { Badge, Card, PageHeader } from '@/components/ui';
import { NotesForm, RedeemButton, SegmentBadge, StampDots, birthdayLabel, contactHref, contactLabel } from '@/components/customers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ficha del cliente · Stampa' };

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, program, template } = ctx;
  const v = template.vocab;
  const detail = await repo.getCustomerDetail(business.id, params.id);
  if (!detail) notFound();
  const { customer: c } = detail;
  const history = [...detail.history].sort((a, b) => (a.at < b.at ? 1 : -1));
  const pending = pendingRewards(c, program);
  const ready = pending.length > 0;
  const next = nextReward(c.stamps, program);
  const now = Date.now();

  const EVENT = {
    stamp: { label: 'Sello registrado', dot: 'bg-navy' },
    void: { label: 'Sello anulado', dot: 'bg-bad' },
    redeem: { label: `${v.reward.charAt(0).toUpperCase() + v.reward.slice(1)} canjeado`, dot: 'bg-sun ring-2 ring-navy' }
  } as const;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta de navegación" className="text-sm">
        <Link href="/panel/clientes" className="font-medium text-navy underline underline-offset-4">Volver a {v.customers}</Link>
      </nav>
      <PageHeader title={c.name} subtitle={`Desde el ${dateShort(c.createdAt)}`} actions={<SegmentBadge segment={c.segment} />} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="flex flex-col gap-4">
          <StampDots filled={c.stamps} total={program.stampsRequired} colors={program.colors} logoText={program.logoText} title={program.name} subtitle={`Premio: ${program.rewardTitle}`} />
          <Card>
            <h2 className="font-display text-base font-semibold text-navy">{ready ? 'Premio por canjear' : 'Premio'}</h2>
            <p className="mt-1 text-sm text-muted">
              {ready ? `${c.name} ya puede canjear: ${pending.map((p) => p.title).join(', ')}.` : `Le faltan ${Math.max(0, next.at - c.stamps)} sellos para ${lcfirst(next.title)}.`}
            </p>
            {pending.map((p) => (
              <RedeemButton key={p.milestone ?? 'final'} customerId={c.id} customerName={c.name} rewardTitle={p.title} milestone={p.milestone} />
            ))}
          </Card>
          <Card>
            <h2 className="font-display text-base font-semibold text-navy">Resumen</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Sellos de por vida</dt><dd className="font-semibold tabular-nums text-navy">{c.totalStamps}</dd></div>
              <div><dt className="text-xs text-muted">Premios canjeados</dt><dd className="font-semibold tabular-nums text-navy">{c.rewardsRedeemed}</dd></div>
              <div><dt className="text-xs text-muted">Última {v.visit}</dt><dd className="font-semibold text-navy">{c.lastVisitAt ? ago(c.lastVisitAt, now) : 'Sin ' + v.visits}</dd></div>
              <div><dt className="text-xs text-muted">Tarjeta en el celular</dt><dd className="font-semibold text-navy">{c.wallet === 'apple' ? 'Apple Wallet' : c.wallet === 'google' ? 'Google Wallet' : 'Aún no la agrega'}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-display text-base font-semibold text-navy">Contacto</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{contactLabel(c.contactKind)}</dt>
                <dd className="break-all font-semibold text-navy">
                  <a href={contactHref(c.contactKind, c.contact)} className="underline underline-offset-4" {...(c.contactKind === 'whatsapp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    {c.contact}
                  </a>
                  {c.emailVerifiedAt && <span className="mt-0.5 block text-xs font-normal text-[#12683F]">Correo confirmado el {dateShort(c.emailVerifiedAt)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{c.birthdayYear ? 'Fecha de nacimiento' : 'Cumpleaños'}</dt>
                <dd className="font-semibold text-navy">
                  {birthdayLabel(c) ?? 'No registrado'}
                  {c.birthday && program.birthdayReward && <span className="block text-xs font-normal text-muted">Regalo: {program.birthdayReward}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Acepta mensajes</dt>
                <dd className="font-semibold text-navy">Desde el {dateShort(c.consentAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card><NotesForm customerId={c.id} notes={c.notes} /></Card>

          <Card>
            <h2 className="font-display text-base font-semibold text-navy">Historial</h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Sin movimientos.</p>
            ) : (
              <ol className="mt-4 flex flex-col">
                {history.map((h, i) => {
                  const e = EVENT[h.kind];
                  return (
                    <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < history.length - 1 && <span aria-hidden className="absolute left-[7px] top-4 h-full w-px bg-line" />}
                      <span aria-hidden className={cn('relative mt-1 h-4 w-4 shrink-0 rounded-full', e.dot)} />
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-navy">{e.label}{h.ticket && <span className="ml-2 align-middle"><Badge>{v.ticket} {h.ticket}</Badge></span>}</p>
                        <p className="text-xs text-muted">
                          <time dateTime={h.at}>{dateTime(h.at)}</time>
                          {h.staffName ? ` · ${h.staffName}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
