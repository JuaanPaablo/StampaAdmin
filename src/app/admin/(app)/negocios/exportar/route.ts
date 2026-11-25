import { NextRequest } from 'next/server';
import { applyListFilters, businessesCsv, parseListParams, sortRows } from '@/components/admin/helpers';
import { getAdminSession } from '@/lib/admin-session';
import { ecDayKey } from '@/lib/domain/admin-insights';

export const dynamic = 'force-dynamic';

/**
 * Descarga la lista de negocios en CSV con los mismos filtros y orden que /admin/negocios (q, estado, salud, plan, orden, dir).
 * Solo para administradores: sin sesión responde 401 (no redirige, para que la descarga no guarde una página HTML).
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new Response('Inicia sesión como administrador para descargar este archivo.', {
      status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  const p = parseListParams(req.nextUrl.searchParams);
  const now = Date.now();
  const rows = sortRows(applyListFilters(await session.repo.listAdminBusinesses(), p, now), p.orden, p.dir);
  return new Response(businessesCsv(rows, now), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="negocios-stampa-${ecDayKey(now)}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
