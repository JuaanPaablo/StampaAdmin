import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { btnClass, PageHeader } from '@/components/ui';
import { ProgramForm } from '@/components/card/ProgramForm';
import { BusinessImages } from '@/components/card/BusinessImages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tarjeta · Stampa' };

export default async function TarjetaPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, program, template } = ctx;

  return (
    <>
      <PageHeader
        title="Tarjeta"
        subtitle={`Diseña la tarjeta de sellos de ${business.name}. Lo que cambies se ve al instante en la vista previa.`}
        actions={<Link href="/panel/tarjeta/poster" className={btnClass('ghost')}>Póster con QR</Link>}
      />
      <ProgramForm
        program={program}
        businessName={business.name}
        vocab={template.vocab}
        rewardIdeas={template.rewardIdeas}
        templateColors={template.program.colors}
        imagesSlot={<BusinessImages logoUrl={program.logoUrl} coverUrl={program.coverUrl} logoText={program.logoText} />}
      />
    </>
  );
}
