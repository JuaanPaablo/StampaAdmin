import { NextResponse } from 'next/server';
import { features } from '@/lib/plans';
import { getContext } from '@/lib/context';
import { toCsv } from '@/components/control/csv';
import { auditLabel } from '@/components/control/labels';
import { isoLocal } from '@/components/register/time';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { repo, business, template, staff } = await getContext();
  if (staff.role === 'cashier') return new NextResponse('Solo dueño y gerente pueden exportar.', { status: 403 });
  if (!features(business.plan).exportCsv) return new NextResponse('Exportar el registro está disponible desde el plan Standard.', { status: 403 });

  const accion = (new URL(req.url).searchParams.get('accion') ?? '').slice(0, 60);
  const [entries, staffList] = await Promise.all([repo.listAudit(business.id, 5000), repo.listStaff(business.id)]);
  const names = new Map(staffList.map((s) => [s.id, s.name]));
  const rows = (accion ? entries.filter((e) => e.action === accion) : entries).map((e) => [
    isoLocal(e.at, business.timezone),
    e.staffId ? names.get(e.staffId) ?? e.staffId : 'Sistema',
    auditLabel(e.action, template.vocab),
    e.action,
    e.detail
  ]);

  const body = toCsv(['Fecha', 'Quién', 'Acción', 'Código de acción', 'Detalle'], rows);
  const day = new Date().toISOString().slice(0, 10);
  const slug = business.slug.replace(/[^a-z0-9-]/gi, '') || 'negocio';
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="actividad-${slug}-${day}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
