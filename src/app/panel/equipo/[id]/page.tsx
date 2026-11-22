import { notFound } from 'next/navigation';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { Badge, PageHeader } from '@/components/ui';
import { StaffForm } from '@/components/team/StaffForm';
import { ResetPinForm } from '@/components/team/ResetPinForm';
import { InviteCard } from '@/components/team/InviteCard';
import { roleLabel, roleTone } from '@/components/team/roles';
import { isSoleOwner } from '@/components/team/rules';
import { accessStatus } from '@/components/team/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Equipo · Stampa' };

export default async function EditarPage({ params, searchParams }: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: { ok?: string } | Promise<{ ok?: string }>;
}) {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template, staff: me } = ctx;
  const { id } = await Promise.resolve(params);
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const [people, locations] = await Promise.all([repo.listStaff(business.id), repo.listLocations(business.id)]);
  const person = people.find((p) => p.id === id);
  if (!person) notFound();
  const status = accessStatus(person);

  return (
    <>
      <PageHeader
        title={person.name}
        actions={<><Badge tone={roleTone[person.role]}>{roleLabel(person.role, template.vocab)}</Badge><Badge tone={person.active ? 'ok' : 'neutral'}>{person.active ? 'Activo' : 'Desactivado'}</Badge></>}
      />
      {sp.ok === 'creado' && (
        <p role="status" className="mb-5 max-w-2xl rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">
          {person.name} ya está en tu equipo. {status === 'none' ? 'Agrega su correo para invitarla al panel.' : 'Ahora envíale la invitación para que cree su contraseña.'}
        </p>
      )}
      {sp.ok === 'creado-sin-correo' && (
        <p role="status" className="mb-5 max-w-2xl rounded-xl bg-[#FFF3CC] px-4 py-3 text-sm font-medium text-[#7A5A00]">
          {person.name} ya está en tu equipo, pero no pudimos guardar su correo (quizá ya lo usa otra cuenta). Prueba con otro aquí abajo.
        </p>
      )}
      <div className="max-w-2xl space-y-5">
        <InviteCard key={`invite-${person.id}`} staffId={person.id} name={person.name} email={person.email} status={status} active={person.active} isMe={person.id === me.id} />
        <StaffForm key={`form-${person.id}`} staff={person} locations={locations} vocab={template.vocab} soleOwner={isSoleOwner(person, people)} />
        <ResetPinForm staffId={person.id} name={person.name} hasPin={person.hasPin} />
      </div>
    </>
  );
}
