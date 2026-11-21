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
import { Countdown } from '@/components/register/Countdown';
import { DemoPanel } from '@/components/register/DemoPanel';
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

  let reason = '';
  if (status === 'agotado') reason = 'Se llenaron todos los cupos.';
  else if (status === 'vencido') reason = 'Pasó la vigencia (' + clock(code.expiresAt, tz) + ').';
  else if (status === 'cancelado') reason = 'Se canceló' + (code.cancelledAt ? ' a las ' + clock(code.cancelledAt, tz) : '') + '.';

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <LiveRefresh active={active} expiresAt={code.expiresAt} />
      <PageHeader
        title={v.ticket + ' ' + code.ticket}
        subtitle={(program.requireAmount && code.amountCents > 0 ? money(code.amountCents) + ' · ' : '') + code.seats + (code.seats === 1 ? ' cupo' : ' cupos') + ' · creado a las ' + clock(code.createdAt, tz) + (staffNames[code.createdBy] ? ' por ' + staffNames[code.createdBy] : '')}
        actions={<Link href="/panel/caja" className={btnClass('ghost', 'sm')}>Volver a {v.counter.toLowerCase()}</Link>} />

      {!active && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-navy px-5 py-5 text-white shadow-card">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold">Código quemado</p>
            <p className="mt-1 text-sm text-white/80">{reason} Ya no sirve para reclamar sellos; si alguien lo intenta, se rechaza y queda registrado.</p>
          </div>
          <Link href="/panel/caja" className={btnClass('primary')}>Nuevo código</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card className="flex flex-col items-center gap-5 p-5 sm:p-7">
          <div className="flex w-full items-center justify-between">
            <h2 className="font-display text-base font-semibold text-navy">Código de un solo uso</h2>
            <StatusBadge status={status} />
          </div>
          {active ? (
            <div role="img" aria-label={'Código QR del código ' + code.code.split('').join(' ')}
              className="aspect-square w-full max-w-[20rem] rounded-2xl bg-white p-2 ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : (
            <div className="flex aspect-square w-full max-w-[20rem] items-center justify-center rounded-2xl bg-surface p-6 text-center text-sm text-muted ring-1 ring-line">
              El QR ya no está disponible porque el código se quemó.
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            {active && <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">O escribe este código</p>}
            <p className={'font-display text-6xl font-extrabold tracking-[0.12em] tabular-nums sm:text-7xl ' + (active ? 'text-navy' : 'text-muted line-through')} aria-label={'Código ' + code.code.split('').join(' ')}>{grouped}</p>
          </div>
          <p className="text-center text-sm text-muted">{active ? `Tu ${v.customer} escanea el QR con la cámara o escribe el código en su tarjeta.` : 'Código fuera de uso.'}</p>
          <Countdown expiresAt={code.expiresAt} createdAt={code.createdAt} active={active} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-navy">Cupos</h2>
              <p className="text-sm font-semibold text-navy tabular-nums" aria-live="polite">{used} de {code.seats} reclamados</p>
            </div>
            <div className="mt-3"><SeatPips seats={code.seats} claims={code.claims} /></div>
            {valid !== used && <p className="mt-2 text-xs text-muted">{used - valid} anulado{used - valid === 1 ? '' : 's'}: el cupo no se devuelve.</p>}
            {code.approvedBy && <p className="mt-3 text-xs text-muted">Aprobado por <span className="font-semibold text-navy">{staffNames[code.approvedBy] ?? 'un gerente'}</span> con PIN.</p>}
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-base font-semibold text-navy">Quién reclamó</h2>
            <ClaimList codeId={code.id} claims={code.claims} timezone={tz} customerWord={v.customer} canVoid={staff.role !== 'cashier'} />
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-navy">Intentos rechazados</h2>
              <p className="text-xs text-muted">Alguien probó el código cuando ya estaba quemado o repetido.</p>
            </div>
            <div aria-live="polite">
              {code.attempts > 0 ? <Badge tone="warn">{code.attempts} {code.attempts === 1 ? 'intento' : 'intentos'}</Badge> : <span className="text-2xl font-bold tabular-nums text-navy">0</span>}
            </div>
          </Card>

          {canCancel && (
            <ActionButton action={cancelCodeAction} fields={{ codeId: code.id }} label="Cancelar código" confirmLabel="Sí, cancelar código" variant="danger"
              confirmQuestion={'Se quema ahora mismo y nadie más podrá reclamar. Los ' + v.customers + ' que ya reclamaron conservan su sello.'} pendingText="Cancelando…" />
          )}
        </div>
      </div>

      {isDemoMode() && (
        <DemoPanel codeId={code.id} burned={!active} vocab={{ customer: v.customer, customers: v.customers }}
          customers={customers.slice(0, 80).map((c) => ({ id: c.id, name: c.name }))} />
      )}

      <RewardsSection redeemable={redeemable} redemptions={redemptions} stampsRequired={program.stampsRequired} rewardTitle={program.rewardTitle}
        vocab={{ customer: v.customer, customers: v.customers, reward: v.reward }} staffNames={staffNames} />

      <RecentCodes codes={codes} statuses={statuses} ticketWord={v.ticket} showAmount={program.requireAmount} excludeId={code.id} />
    </div>
  );
}
