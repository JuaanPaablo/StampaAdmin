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
import { stampaWhatsappUrl } from '@/lib/urls';

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
        actions={<Link href="/panel/equipo/nuevo" className={btnClass('primary')}>Agregar persona</Link>}
      />
      <p className={'mb-5 rounded-xl px-4 py-3 text-sm ' + (atLimit ? 'bg-[#FFF3CC] text-[#7A5A00]' : 'bg-surface text-muted')}>
        {Number.isFinite(limit)
          ? <>Plan {PLAN_LABEL[business.plan]}: <strong className="text-navy">{activeTeam} de {limit}</strong> personas activas, además de ti.</>
          : staffLimitText(business.plan, PLAN_LABEL[business.plan])}
        {atLimit && <> Llegaste al límite: desactiva a alguien o{' '}
          <a href={stampaWhatsappUrl(`Hola, quiero ampliar mi plan de Stampa para ${business.name} y sumar más personas a mi equipo`)} target="_blank" rel="noopener noreferrer"
            className="font-semibold underline underline-offset-4">amplía tu plan</a>.</>}
      </p>
      {sp.ok === 'creado' && (
        <p role="status" className="mb-5 rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">Persona agregada. Envíale la invitación para que entre al panel.</p>
      )}

      <div className="space-y-6">
        {/* En el celular, una tarjeta por persona: todo a la vista y toda la fila se puede tocar. */}
        <ul className="flex flex-col gap-2 sm:hidden" aria-label="Personas del equipo">
          {sorted.map((p) => {
            const access = accessStatus(p);
            return (
              <li key={p.id}>
                <Link href={`/panel/equipo/${p.id}`}
                  className={'flex items-center gap-3 rounded-2xl p-4 shadow-card ring-1 ring-line/70 ' + (p.active ? 'bg-white' : 'bg-surface')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy">
                      {p.name}{p.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {p.locationId ? locName.get(p.locationId) ?? 'Sucursal eliminada' : 'Todas las sucursales'}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={roleTone[p.role]}>{roleLabel(p.role, v)}</Badge>
                      {!p.active && <Badge tone="neutral">Desactivado</Badge>}
                      {p.active && access !== 'active' && <Badge tone={ACCESS_TONE[access]}>{ACCESS_LABEL[access]}</Badge>}
                      {p.active && !p.hasPin && <Badge tone="warn">Sin PIN</Badge>}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-xl text-muted">›</span>
                  <span className="sr-only">Editar a {p.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Table className="hidden sm:block">
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
                <Td className={p.locationId && !locName.has(p.locationId) ? 'text-[#7A5A00]' : 'text-muted'}>{p.locationId ? locName.get(p.locationId) ?? 'Sucursal eliminada' : 'Todas'}</Td>
                <Td><Badge tone={ACCESS_TONE[accessStatus(p)]}>{ACCESS_LABEL[accessStatus(p)]}</Badge></Td>
                <Td><Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? 'Activo' : 'Desactivado'}</Badge></Td>
                <Td><Badge tone={p.hasPin ? 'ok' : 'warn'}>{p.hasPin ? 'Con PIN' : 'Sin PIN'}</Badge></Td>
                <Td className="text-right">
                  <Link href={`/panel/equipo/${p.id}`} className={btnClass('ghost')}>
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
            text={`Cada sello queda a nombre de quien lo dio.`}
            action={<Link href="/panel/equipo/nuevo" className={btnClass('primary', 'sm')}>Agregar la primera persona</Link>}
          />
        )}

        <RoleMatrix vocab={v} />
      </div>
    </>
  );
}
