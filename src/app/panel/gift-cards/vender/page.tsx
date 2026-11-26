import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { cheapestWith, features } from '@/lib/plans';
import { Card, PageHeader } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { SellGiftForm } from '@/components/giftcards/SellGiftForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vender gift card · Stampa' };

export default async function VenderGiftPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, template } = ctx;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta de navegación" className="-mb-3 text-sm">
        <Link href="/panel/gift-cards" className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
          <span aria-hidden>←</span> Gift Cards
        </Link>
      </nav>
      <PageHeader title="Vender gift card" subtitle="Cobra el monto como siempre y registra aquí la venta. Te damos el código para entregar." />
      {features(business.plan).giftCards ? (
        <Card className="sm:p-6"><SellGiftForm businessName={business.name} customerWord={template.vocab.customer} /></Card>
      ) : (
        <PlanLock plan={cheapestWith((f) => f.giftCards) ?? 'pro'} businessName={business.name} title="Gift Cards con saldo"
          text="Vende tarjetas de regalo: tus clientes las guardan en el celular y pagan con el saldo en caja." />
      )}
    </div>
  );
}
