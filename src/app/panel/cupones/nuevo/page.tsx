import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { cheapestWith, features } from '@/lib/plans';
import { PageHeader } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { OfferForm } from '@/components/offers/OfferForm';
import { offerFormDefaults, todayEc } from '@/components/offers/offer-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Crear cupón · Stampa' };

export default async function NuevoCuponPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, program } = ctx;
  const now = Date.now();

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta de navegación" className="-mb-3 text-sm">
        <Link href="/panel/cupones" className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
          <span aria-hidden>←</span> Cupones
        </Link>
      </nav>
      <PageHeader title="Crear cupón" subtitle="Escribe la promoción y mira a la derecha cómo la verán tus clientes." />
      {features(business.plan).offers ? (
        <OfferForm defaults={offerFormDefaults(undefined, now)} today={todayEc(now)}
          brand={{ businessName: business.name, logoText: program.logoText, logoUrl: program.logoUrl, colors: program.colors }} />
      ) : (
        <PlanLock plan={cheapestWith((f) => f.offers) ?? 'standard'} businessName={business.name} title="Cupones en el Wallet de tus clientes"
          text="Envía promociones que llegan al celular de tus clientes con un aviso, y canjéalas en caja." />
      )}
    </div>
  );
}
