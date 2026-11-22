import { maxStaff, staffLimitText } from '@/lib/plan-rules';
import { PLAN_LABEL } from '@/lib/plans';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { Badge, EmptyState, PageHeader, Table, Td, Th, btnClass } from '@/components/ui';
import { RoleMatrix } from '@/components/team/RoleMatrix';
import { roleLabel, roleTone } from '@/components/team/roles';
import type { Role } from '@/lib/contracts';
import { ACCESS_LABEL, ACCESS_TONE, accessStatus } from '@/components/team/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Equipo · Stampa' };

const ORDER: Record<Role, number> = { owner: 0, manager: 1, cashier: 2 };

export default async function EquipoPage({ searchParams }: { searchParams?: { ok?: string } | Promise<{ ok?: string }> }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template, staff: me } = ctx;
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const v = template.vocab;

  const [people, locations] = await Promise.all([repo.listStaff(business.id), repo.listLocations(business.id)]);
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const sorted = [...people].sort((a, b) => Number(b.active) - Number(a.active) || ORDER[a.role] - ORDER[b.role] || a.name.localeCompare(b.name, 'es'));
  const onlyOwner = people.filter((p) => p.role !== 'owner').length === 0;
  const limit = maxStaff(business.plan);
  const activeTeam = people.filter((p) => p.active && p.role !== 'owner').length;
  const atLimit = Number.isFinite(limit) && activeTeam >= limit;

  return (
    <>
      <PageHeader
        title="Equipo"
        subtitle={`Quienes atienden y administran ${business.name}. Cada persona entra con su correo y su contraseña, así sabes quién dio cada sello.`}
        actions={<Link href="/panel/equipo/nuevo" className={btnClass('primary')}>Agregar persona</Link>}
      />
      <p className={'mb-5 rounded-xl px-4 py-3 text-sm ' + (atLimit ? 'bg-[#FFF3CC] text-[#7A5A00]' : 'bg-surface text-muted')}>
        {staffLimitText(business.plan, PLAN_LABEL[business.plan])}
        {Number.isFinite(limit) && <> Hoy tienes <strong className="text-navy">{activeTeam} de {limit}</strong> activas.</>}
        {atLimit && <> Para sumar a alguien, desactiva a otra persona o cambia a un plan mayor.</>}
      </p>
      {sp.ok === 'creado' && (
        <p role="status" className="mb-5 rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">Persona agregada. Agrega su correo y envíale la invitación para que entre al panel.</p>
      )}

      <div className="space-y-6">
        <Table>
          <caption className="sr-only">Personas del equipo</caption>
          <thead>
            <tr><Th>Nombre</Th><Th>Rol</Th><Th>Sucursal</Th><Th>Acceso al panel</Th><Th>Estado</Th><Th>PIN</Th><Th><span className="sr-only">Acciones</span></Th></tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'bg-surface/60'}>
                <Td className="font-semibold">
                  {p.name}{p.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                  {p.email && <span className="block max-w-[220px] truncate text-xs font-normal text-muted">{p.email}</span>}
                </Td>
                <Td><Badge tone={roleTone[p.role]}>{roleLabel(p.role, v)}</Badge></Td>
                <Td className="text-muted">{p.locationId ? locName.get(p.locationId) ?? 'Sucursal eliminada' : 'Todas'}</Td>
                <Td><Badge tone={ACCESS_TONE[accessStatus(p)]}>{ACCESS_LABEL[accessStatus(p)]}</Badge></Td>
                <Td><Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? 'Activo' : 'Desactivado'}</Badge></Td>
                <Td><Badge tone={p.hasPin ? 'ok' : 'warn'}>{p.hasPin ? 'Con PIN' : 'Sin PIN'}</Badge></Td>
                <Td className="text-right">
                  <Link href={`/panel/equipo/${p.id}`} className={btnClass('ghost', 'sm')}>
                    Editar<span className="sr-only"> a {p.name}</span>
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {onlyOwner && (
          <EmptyState
            title="Aún no tienes equipo"
            text={`Agrega a tu ${v.staffRole} e invítalo con su correo. Así cada sello queda a nombre de quien lo dio.`}
            action={<Link href="/panel/equipo/nuevo" className={btnClass('primary', 'sm')}>Agregar la primera persona</Link>}
          />
        )}

        <RoleMatrix vocab={v} />
      </div>
    </>
  );
}
