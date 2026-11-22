import { Card, PageHeader } from '@/components/ui';
import { getContext } from '@/lib/context';
import { codeStatus } from '@/lib/domain';
import type { CodeStatus } from '@/lib/contracts';
import { CodeForm } from '@/components/register/CodeForm';
import { RecentCodes } from '@/components/register/RecentCodes';
import { RewardsSection } from '@/components/register/RewardsSection';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja · Stampa' };

export default async function CajaPage() {
  const { repo, business, program, template, staff } = await getContext();
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
    <div className="flex w-full max-w-3xl flex-col gap-8 xl:max-w-6xl">
      <PageHeader title={v.counter} subtitle={'Hola, ' + staff.name + '. Cada ' + v.visit + ' genera un código de un solo uso.'}
        actions={<a href="#premios" className="text-sm font-semibold text-navy underline underline-offset-4">Ir a canjes</a>} />

      {/* En pantallas anchas: el formulario a la izquierda y los últimos códigos a la derecha. */}
      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <Card as="section" className="p-5 sm:p-7">
          <h2 className="mb-1 font-display text-xl font-semibold text-navy">Dar un sello</h2>
          <p className="mb-5 text-sm text-muted">
            Ingresa los datos del comprobante y entrega el código al {v.customer}. Si vienen varios juntos, agrega un cupo por persona: cada uno escanea con su teléfono.
          </p>
          <CodeForm program={program} vocab={{ ticket: v.ticket, people: v.people, customers: v.customers }} />
        </Card>

        <RecentCodes codes={codes} statuses={statuses} ticketWord={v.ticket} showAmount={program.requireAmount} />
      </div>

      <RewardsSection redeemable={redeemable} redemptions={redemptions} stampsRequired={program.stampsRequired} rewardTitle={program.rewardTitle} milestones={program.milestones}
        vocab={{ customer: v.customer, customers: v.customers, reward: v.reward }} staffNames={staffNames} />
    </div>
  );
}
