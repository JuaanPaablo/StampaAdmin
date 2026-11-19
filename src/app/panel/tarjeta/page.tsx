import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { btnClass, PageHeader } from '@/components/ui';
import { ProgramForm } from '@/components/card/ProgramForm';

export const dynamic = 'force-dynamic';

export default async function TarjetaPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, program, template } = ctx;

  return (
    <>
      <PageHeader
        title="Tarjeta"
        subtitle={`Diseña la tarjeta de sellos de ${business.name} y define cómo se entregan los sellos. Lo que cambies aquí se ve al instante en la vista previa.`}
        actions={<Link href="/panel/tarjeta/poster" className={btnClass('ghost')}>Póster con QR</Link>}
      />
      <ProgramForm
        program={program}
        businessName={business.name}
        vocab={template.vocab}
        rewardIdeas={template.rewardIdeas}
        templateColors={template.program.colors}
      />
    </>
  );
}
