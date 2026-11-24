import { Card, PageHeader } from '@/components/ui';
import { getContext } from '@/lib/context';
import { codeStatus } from '@/lib/domain';
import type { CodeStatus } from '@/lib/contracts';
import { CodeForm } from '@/components/register/CodeForm';
import { FlashRegion } from '@/components/register/FlashRegion';
import { RecentCodes } from '@/components/register/RecentCodes';
import { RewardsSection } from '@/components/register/RewardsSection';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja · Stampa' };

export default async function CajaPage() {
  const { repo, business, program, template } = await getContext();
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

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 sm:gap-8 xl:max-w-6xl">
      <FlashRegion />
      <PageHeader title={v.counter}
        actions={<a href="#premios" className="inline-flex h-9 min-h-11 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface">
          Por canjear{redeemable.length > 0 && <span className="rounded-full bg-sun px-2 py-0.5 text-xs tabular-nums"><span className="sr-only">: </span>{redeemable.length}</span>}
        </a>} />

      {/* En pantallas anchas: el formulario a la izquierda y los últimos códigos a la derecha. */}
      <div className="flex flex-col gap-6 sm:gap-8 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <Card as="section" className="p-4 sm:p-7">
          <h2 className="mb-4 font-display text-xl font-semibold text-navy">Dar un sello</h2>
          <CodeForm program={program} vocab={{ ticket: v.ticket, people: v.people, customers: v.customers }} />
        </Card>

        <RecentCodes codes={codes} statuses={statuses} ticketWord={v.ticket} showAmount={program.requireAmount} />
      </div>

      <RewardsSection redeemable={redeemable} redemptions={redemptions} stampsRequired={program.stampsRequired} rewardTitle={program.rewardTitle} milestones={program.milestones}
        vocab={{ customer: v.customer, customers: v.customers, reward: v.reward }} staffNames={staffNames} />
    </div>
  );
}
