import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { StaffForm } from '@/components/team/StaffForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agregar persona · Stampa' };

export default async function NuevoPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template } = ctx;
  const locations = await repo.listLocations(business.id);
  return (
    <>
      <PageHeader title="Agregar persona" subtitle={`Agrega a alguien de tu equipo. Para ${template.vocab.staffRole} elige el rol con menos permisos.`} />
      <div className="max-w-2xl"><StaffForm locations={locations} vocab={template.vocab} /></div>
    </>
  );
}
