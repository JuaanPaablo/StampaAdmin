import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { Badge, btnClass, Card, PageHeader } from '@/components/ui';
import { getContext } from '@/lib/context';
import { isDemoMode } from '@/lib/demo';
import { codeStatus } from '@/lib/domain';
import { money } from '@/lib/format';
import { cancelCodeAction } from '../actions';
import { ActionButton } from '@/components/register/ActionButton';
import { ClaimList } from '@/components/register/ClaimList';
import { ClaimNotice } from '@/components/register/ClaimNotice';
import { Countdown } from '@/components/register/Countdown';
import { DemoPanel } from '@/components/register/DemoPanel';
import { FlashRegion } from '@/components/register/FlashRegion';
import { LiveIndicator } from '@/components/register/LiveIndicator';
import { LiveRefresh } from '@/components/register/LiveRefresh';
import { RecentCodes } from '@/components/register/RecentCodes';
import { RewardsSection } from '@/components/register/RewardsSection';
import { SeatPips } from '@/components/register/SeatPips';
import { StatusBadge } from '@/components/register/StatusBadge';
import { clock, groupCode } from '@/components/register/time';
import type { CodeStatus } from '@/lib/contracts';
import { stampUrl } from '@/lib/urls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Código de sello · Stampa' };

export default async function CodePage({ params }: { params: { id: string } }) {
  const { repo, business, program, template, staff } = await getContext();
  const v = template.vocab;
  const code = await repo.getStampCode(business.id, params.id);
  if (!code) notFound();

  const [codes, customers, redeemable, redemptions, staffList] = await Promise.all([
    repo.listStampCodes(business.id, 6),
    repo.listCustomers(business.id, { sort: 'recientes' }),
    repo.listRedeemable(business.id),
    repo.listRedemptions(business.id, 6),
    repo.listStaff(business.id)
  ]);

  const now = new Date();
  const status = codeStatus(code, now);
  const active = status === 'activo';
  const statuses: Record<string, CodeStatus> = Object.fromEntries(codes.map((c) => [c.id, codeStatus(c, now)]));
  const staffNames = Object.fromEntries(staffList.map((s) => [s.id, s.name]));
  const tz = business.timezone;
  const grouped = groupCode(code.code);
  const used = code.claims.length;
  const valid = code.claims.filter((c) => !c.voidedAt).length;
  const canCancel = active;

  const qrSvg = active
    ? await QRCode.toString(stampUrl(business.slug, code.code), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#001D3D', light: '#FFFFFF' } })
    : '';

  const latest = [...code.claims].sort((a, b) => b.at.localeCompare(a.at))[0];
  const claimedText = used + ' de ' + code.seats + ' reclamados';

  // Aviso cuando el código ya no recibe reclamos. "Completo" es un buen final: va en verde.
  const ended = {
    agotado: { title: 'Listo: cupos completos', text: 'Todos recibieron su sello.', box: 'bg-[#DDF3E8] text-[#0E5232] ring-1 ring-[#B5E2CB]', sub: 'text-[#12683F]' },
    vencido: { title: 'Código vencido', text: 'Venció a las ' + clock(code.expiresAt, tz) + ' · ' + claimedText + '.', box: 'bg-navy text-white', sub: 'text-white/80' },
    cancelado: { title: 'Código cancelado', text: (code.cancelledAt ? 'Se canceló a las ' + clock(code.cancelledAt, tz) : 'Se canceló') + ' · ' + claimedText + '.', box: 'bg-navy text-white', sub: 'text-white/80' }
  } as const;
  const end = status === 'activo' ? null : ended[status];

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 sm:gap-8">
      <LiveRefresh active={active} expiresAt={code.expiresAt} />
      <ClaimNotice key={code.id} count={used} latestName={latest?.customerName} customers={v.customers} full={status === 'agotado'} />
      <FlashRegion />
      <PageHeader
        title={v.ticket + ' ' + code.ticket}
        subtitle={(program.requireAmount && code.amountCents > 0 ? money(code.amountCents) + ' · ' : '') + code.seats + (code.seats === 1 ? ' cupo' : ' cupos') + ' · creado a las ' + clock(code.createdAt, tz) + (staffNames[code.createdBy] ? ' por ' + staffNames[code.createdBy] : '')}
        actions={active ? <Link href="/panel/caja" className={btnClass('ghost', 'sm') + ' min-h-11'}>Nuevo código</Link> : undefined} />

      {end && (
        <div role="status" className={'flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-5 shadow-card ' + end.box}>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold">{end.title}</p>
            <p className={'mt-1 text-sm ' + end.sub}>{end.text}</p>
          </div>
          <Link href="/panel/caja" className={btnClass('primary') + ' w-full sm:w-auto'}>Nuevo código</Link>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card className="flex flex-col items-center gap-4 p-4 sm:gap-5 sm:p-7">
          <div className="flex w-full items-center justify-between">
            <h2 className="font-display text-base font-semibold text-navy">Código</h2>
            <StatusBadge status={status} />
          </div>
          {active ? (
            <div role="img" aria-label={'Código QR del código ' + code.code.split('').join(' ')}
              className="aspect-square w-full max-w-[20rem] rounded-2xl bg-white p-2 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : (
            <div className="flex aspect-square w-full max-w-[20rem] items-center justify-center rounded-2xl bg-surface p-6 text-center text-sm text-muted ring-1 ring-line">
              QR no disponible
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            {active && <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">O escribe este código</p>}
            <p className={'font-display text-6xl font-extrabold tracking-[0.12em] tabular-nums sm:text-7xl ' + (active ? 'text-navy' : 'text-muted line-through')} aria-label={'Código ' + code.code.split('').join(' ')}>{grouped}</p>
          </div>
          <Countdown expiresAt={code.expiresAt} createdAt={code.createdAt} active={active} />
        </Card>

        <div className="flex flex-col gap-4 sm:gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-navy">Cupos</h2>
              <p className="text-sm font-semibold text-navy tabular-nums">{claimedText}</p>
            </div>
            <div className="mt-3"><SeatPips seats={code.seats} claims={code.claims} /></div>
            {valid !== used && <p className="mt-2 text-xs text-muted">{used - valid} anulado{used - valid === 1 ? '' : 's'}: el cupo no se devuelve.</p>}
            {code.approvedBy && <p className="mt-3 text-xs text-muted">Aprobado por <span className="font-semibold text-navy">{staffNames[code.approvedBy] ?? 'un gerente'}</span> con PIN.</p>}
            {code.attempts > 0 && (
              <p className="mt-3"><Badge tone="warn">{code.attempts} {code.attempts === 1 ? 'intento rechazado' : 'intentos rechazados'}</Badge></p>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-navy">Quién reclamó</h2>
              {active && <LiveIndicator />}
            </div>
            <ClaimList codeId={code.id} claims={code.claims} timezone={tz} customerWord={v.customer} canVoid={staff.role !== 'cashier'} waiting={active} />
          </Card>

          {canCancel && (
            <ActionButton key={code.id} action={cancelCodeAction} fields={{ codeId: code.id }} label="Cancelar código" confirmLabel="Sí, cancelar" variant="danger"
              confirmQuestion="Nadie más podrá reclamar. Quien ya reclamó conserva su sello." pendingText="Cancelando…" showSuccess={false} />
          )}
        </div>
      </div>

      {isDemoMode() && (
        <DemoPanel codeId={code.id} burned={!active} vocab={{ customer: v.customer, customers: v.customers }}
          customers={customers.slice(0, 80).map((c) => ({ id: c.id, name: c.name }))} />
      )}

      <RewardsSection redeemable={redeemable} redemptions={redemptions} stampsRequired={program.stampsRequired} rewardTitle={program.rewardTitle} milestones={program.milestones}
        vocab={{ customer: v.customer, customers: v.customers, reward: v.reward }} staffNames={staffNames} />

      <RecentCodes codes={codes} statuses={statuses} ticketWord={v.ticket} showAmount={program.requireAmount} excludeId={code.id} />
    </div>
  );
}
