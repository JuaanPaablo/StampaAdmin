import { notFound } from 'next/navigation';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { Badge, PageHeader } from '@/components/ui';
import { StaffForm } from '@/components/team/StaffForm';
import { ResetPinForm } from '@/components/team/ResetPinForm';
import { roleLabel, roleTone } from '@/components/team/roles';
import { isSoleOwner } from '@/components/team/rules';

export const dynamic = 'force-dynamic';

export default async function EditarPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template } = ctx;
  const { id } = await Promise.resolve(params);
  const [people, locations] = await Promise.all([repo.listStaff(business.id), repo.listLocations(business.id)]);
  const person = people.find((p) => p.id === id);
  if (!person) notFound();

  return (
    <>
      <PageHeader
        title={person.name}
        subtitle="Edita su rol y su acceso. Los cambios se aplican la próxima vez que entre."
        actions={<><Badge tone={roleTone[person.role]}>{roleLabel(person.role, template.vocab)}</Badge><Badge tone={person.active ? 'ok' : 'neutral'}>{person.active ? 'Activo' : 'Desactivado'}</Badge></>}
      />
      <div className="max-w-2xl space-y-5">
        <StaffForm key={person.id} staff={person} locations={locations} vocab={template.vocab} soleOwner={isSoleOwner(person, people)} />
        <ResetPinForm staffId={person.id} name={person.name} hasPin={person.hasPin} />
      </div>
    </>
  );
}
