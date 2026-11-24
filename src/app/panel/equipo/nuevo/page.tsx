import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { StaffForm } from '@/components/team/StaffForm';
import { RoleMatrix } from '@/components/team/RoleMatrix';
import { maxStaff } from '@/lib/plan-rules';
import { PLAN_LABEL } from '@/lib/plans';
import { stampaWhatsappUrl } from '@/lib/urls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agregar persona · Stampa' };

export default async function NuevoPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template } = ctx;
  const [locations, people] = await Promise.all([repo.listLocations(business.id), repo.listStaff(business.id)]);
  // Avisar del límite del plan antes de llenar el formulario, no después.
  const limit = maxStaff(business.plan);
  const activeTeam = people.filter((p) => p.active && p.role !== 'owner').length;
  const atLimit = Number.isFinite(limit) && activeTeam >= limit;
  return (
    <>
      <PageHeader title="Agregar persona" />
      <div className="max-w-2xl space-y-5">
        {atLimit && (
          <p role="status" className="rounded-xl bg-[#FFF3CC] px-4 py-3 text-sm text-[#7A5A00]">
            Tu plan {PLAN_LABEL[business.plan]} ya tiene {limit} de {limit} personas activas. Solo podrás agregar a otro dueño, salvo que desactives a alguien o{' '}
            <a href={stampaWhatsappUrl(`Hola, quiero ampliar mi plan de Stampa para ${business.name} y sumar más personas a mi equipo`)} target="_blank" rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4">amplíes tu plan</a>.
          </p>
        )}
        <StaffForm locations={locations} vocab={template.vocab} />
        <details className="group rounded-2xl">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden text-sm font-semibold text-navy underline-offset-4 hover:underline">
            <span aria-hidden="true" className="inline-block transition group-open:rotate-90">›</span> Ver todos los permisos por rol
          </summary>
          <div className="mt-3"><RoleMatrix vocab={template.vocab} /></div>
        </details>
      </div>
    </>
  );
}
