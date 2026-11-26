import { Card, PageHeader } from '@/components/ui';
import { getContext } from '@/lib/context';
import { codeStatus } from '@/lib/domain';
import type { CodeStatus } from '@/lib/contracts';
import { CodeForm } from '@/components/register/CodeForm';
import { FlashRegion } from '@/components/register/FlashRegion';
import { RecentCodes } from '@/components/register/RecentCodes';
import { RewardsSection } from '@/components/register/RewardsSection';
import { CounterCodePanel } from '@/components/caja/CounterCodePanel';
import { hasRole } from '@/lib/auth';
import { features } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja · Stampa' };

export default async function CajaPage() {
  const ctx = await getContext();
  const { repo, business, program, template } = ctx;
  const v = template.vocab;
  const [codes, redeemable, redemptions, staffList] = await Promise.all([
    repo.listStampCodes(business.id, 8),
    repo.listRedeemable(business.id),
    repo.listRedemptions(business.id, 6),
    repo.listStaff(business.id)
  ]);
  const now = new Date();
  const statuses: Record<string, CodeStatus> = Object.fromEntries(codes.map((c) => [c.id, codeStatus(c, now)]));
  const staffNames = Object.fromEntries(staffList.map((s) => [s.id, s.name]));
  const plan = features(business.plan);
  // Recargar: solo dueño o gerente y con gift cards en el plan. Canjear cupones y cobrar gift cards: todos (también si el
  // negocio bajó de plan, para no dejar colgado lo ya emitido).
  const canTopup = plan.giftCards && hasRole(ctx, ['owner', 'manager']);
  const walletPlan = plan.offers || plan.giftCards;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 sm:gap-8 xl:max-w-6xl">
      <FlashRegion />
      <PageHeader title={v.counter}
        actions={<>
          {walletPlan && <a href="#cupon-gift" className="inline-flex h-9 min-h-11 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface">Cupón o gift card</a>}
          <a href="#premios" className="inline-flex h-9 min-h-11 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface">
          Por canjear{redeemable.length > 0 && <span className="rounded-full bg-sun px-2 py-0.5 text-xs tabular-nums"><span className="sr-only">: </span>{redeemable.length}</span>}
        </a>
        </>} />

      {/* En pantallas anchas: el formulario a la izquierda y los últimos códigos a la derecha. */}
      <div className="flex flex-col gap-6 sm:gap-8 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <Card as="section" className="p-4 sm:p-7">
          <h2 className="mb-4 font-display text-xl font-semibold text-navy">Dar un sello</h2>
          <CodeForm program={program} vocab={{ ticket: v.ticket, people: v.people, customers: v.customers }} />
        </Card>

        <RecentCodes codes={codes} statuses={statuses} ticketWord={v.ticket} showAmount={program.requireAmount} />
      </div>

      {walletPlan ? (
        <Card as="section" className="scroll-mt-20 p-4 sm:p-7">
          <h2 id="cupon-gift" className="mb-1 scroll-mt-20 font-display text-xl font-semibold text-navy">Cupón o gift card</h2>
          <p className="mb-4 text-sm text-muted">Canjea el cupón o cobra con la gift card que el {v.customer} muestra en su celular.</p>
          <CounterCodePanel canTopup={canTopup} />
        </Card>
      ) : (
        // Sin cupones ni gift cards en el plan: queda plegado por si el negocio bajó de plan y aún hay cupones o saldo por usar.
        <details className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line/70 sm:p-5">
          <summary id="cupon-gift" className="flex min-h-11 cursor-pointer items-center font-display text-base font-semibold text-navy">Cupón o gift card emitidos antes</summary>
          <div className="mt-4"><CounterCodePanel canTopup={false} /></div>
        </details>
      )}

      <RewardsSection redeemable={redeemable} redemptions={redemptions} stampsRequired={program.stampsRequired} rewardTitle={program.rewardTitle} milestones={program.milestones}
        vocab={{ customer: v.customer, customers: v.customers, reward: v.reward }} staffNames={staffNames} />
    </div>
  );
}
