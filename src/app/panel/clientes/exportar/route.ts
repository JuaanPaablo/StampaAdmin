import { NextRequest } from 'next/server';
import { features } from '@/lib/plans';
import { getContext } from '@/lib/context';
import type { CustomerQuery, CustomerSegment } from '@/lib/contracts';
import { MONTHS_FULL } from '@/components/dashboard/helpers';
import { SEGMENT_KEYS, segmentInfo, SORTS } from '@/components/customers/segments';

export const dynamic = 'force-dynamic';

/** Escapa para CSV y neutraliza fórmulas (=, +, -, @, tab, retorno) para que Excel no las ejecute. */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 80);
  const seg = sp.get('segmento') ?? 'todos';
  const sort = sp.get('orden') ?? 'recientes';
  const query: CustomerQuery = {
    search: q || undefined,
    segment: (SEGMENT_KEYS as string[]).includes(seg) ? (seg as CustomerSegment) : 'todos',
    sort: SORTS.some((s) => s.key === sort) ? (sort as CustomerQuery['sort']) : 'recientes'
  };
  const { repo, business, staff } = await getContext();
  if (staff.role === 'cashier') return new Response('Solo dueño y gerente pueden exportar.', { status: 403 });
  // La descarga completa (Ajustes > Privacidad) está en todos los planes: los datos son del negocio. La exportación
  // filtrada por búsqueda o segmento es del plan Standard en adelante.
  const filtered = !!query.search || query.segment !== 'todos' || query.sort !== 'recientes';
  if (filtered && !features(business.plan).exportCsv) return new Response('Exportar con filtros está disponible desde el plan Standard.', { status: 403 });
  const rows = await repo.listCustomers(business.id, query);

  const iso = (s?: string) => (s ? s.slice(0, 10) : '');
  const header = ['Nombre', 'Contacto', 'Tipo de contacto', 'Segmento', 'Sellos actuales', 'Sellos totales', 'Premios canjeados', 'Última visita', 'Cumpleaños', 'Billetera', 'Registro', 'Notas'];
  const lines = [header.map(csvCell).join(',')];
  for (const c of rows) {
    lines.push([
      c.name, c.contact, c.contactKind === 'whatsapp' ? 'WhatsApp' : 'Correo', segmentInfo(c.segment).label,
      c.stamps, c.totalStamps, c.rewardsRedeemed, iso(c.lastVisitAt),
      c.birthday ? `${c.birthday.d} de ${MONTHS_FULL[c.birthday.m]}` : '',
      c.wallet === 'apple' ? 'Apple Wallet' : c.wallet === 'google' ? 'Google Wallet' : '',
      iso(c.createdAt), c.notes ?? ''
    ].map(csvCell).join(','));
  }

  let date = new Date().toISOString().slice(0, 10);
  try { date = new Intl.DateTimeFormat('en-CA', { timeZone: business.timezone }).format(new Date()); } catch { /* zona inválida */ }
  const slug = business.slug.replace(/[^a-z0-9-]/gi, '') || 'negocio';

  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-${slug}-${date}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
