import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { Badge, EmptyState, PageHeader, Table, Td, Th, btnClass } from '@/components/ui';
import { RoleMatrix } from '@/components/team/RoleMatrix';
import { roleLabel, roleTone } from '@/components/team/roles';
import type { Role } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

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

  return (
    <>
      <PageHeader
        title="Equipo"
        subtitle={`Las personas que atienden y administran ${business.name}. Cada una entra con su propio PIN, así sabes quién dio cada sello.`}
        actions={<Link href="/panel/equipo/nuevo" className={btnClass('primary')}>Agregar persona</Link>}
      />
      {sp.ok === 'creado' && (
        <p role="status" className="mb-5 rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">Persona agregada. Ya puede entrar con su PIN.</p>
      )}

      <div className="space-y-6">
        <Table>
          <caption className="sr-only">Personas del equipo</caption>
          <thead>
            <tr><Th>Nombre</Th><Th>Rol</Th><Th>Sucursal</Th><Th>Estado</Th><Th>PIN</Th><Th><span className="sr-only">Acciones</span></Th></tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'bg-surface/60'}>
                <Td className="font-semibold">{p.name}{p.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}</Td>
                <Td><Badge tone={roleTone[p.role]}>{roleLabel(p.role, v)}</Badge></Td>
                <Td className="text-muted">{p.locationId ? locName.get(p.locationId) ?? 'Sucursal eliminada' : 'Todas'}</Td>
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
            text={`Agrega a tu ${v.staffRole} para que dé sellos con su propio PIN. Así el control antifraude puede comparar a cada persona.`}
            action={<Link href="/panel/equipo/nuevo" className={btnClass('primary', 'sm')}>Agregar la primera persona</Link>}
          />
        )}

        <RoleMatrix vocab={v} />
      </div>
    </>
  );
}
