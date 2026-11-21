import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Stat, btnClass } from '@/components/ui';
import { displayName, needsAttention, type AttentionReason } from '@/components/admin/helpers';
import { requireAdmin } from '@/lib/admin-session';
import { num } from '@/lib/format';

export const dynamic = 'force-dynamic';

const REASON: Record<AttentionReason, { tone: 'bad' | 'warn' | 'info'; text: string }> = {
  expired: { tone: 'bad', text: 'Plan vencido' },
  expiring: { tone: 'warn', text: 'Por vencer' },
  invite: { tone: 'info', text: 'Sin entrar' }
};

export default async function AdminSummaryPage() {
  const { repo } = await requireAdmin();
  const [summary, rows] = await Promise.all([repo.getPlatformSummary(), repo.listAdminBusinesses()]);
  const now = Date.now();
  const attention = needsAttention(rows, now);
  const b = summary.businesses;

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle={`${num(b.total)} ${b.total === 1 ? 'negocio' : 'negocios'} en Stampa.`}
        actions={<Link href="/admin/negocios/nuevo" className={btnClass('primary')}>Dar acceso a un negocio</Link>}
      />

      <h2 className="mb-3 font-display text-base font-semibold text-navy">Negocios</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Link href="/admin/negocios?estado=activos" className="rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60"><Stat label="Activos" value={num(b.active)} /></Link>
        <Link href="/admin/negocios?estado=configurando" className="rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60"><Stat label="Configurando" value={num(b.setup)} /></Link>
        <Link href="/admin/negocios?estado=suspendidos" className="rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60"><Stat label="Suspendidos" value={num(b.suspended)} /></Link>
        <Link href="/admin/negocios?estado=por-vencer" className="rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60"><Stat label="Por vencer en 7 días" value={num(b.expiringSoon)} /></Link>
        <Link href="/admin/negocios?estado=vencidos" className="col-span-2 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60 lg:col-span-1"><Stat label="Vencidos" value={num(b.expired)} /></Link>
      </div>

      <h2 className="mb-3 mt-8 font-display text-base font-semibold text-navy">Uso de la plataforma</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Clientes" value={num(summary.customers)} hint="Tarjetas en todos los negocios" />
        <Stat label="Sellos" value={num(summary.stamps30d)} hint={`Últimos 30 días · ${num(summary.stampsTotal)} en total`} />
        <Stat label="Canjes" value={num(summary.redemptions30d)} hint={`Últimos 30 días · ${num(summary.redemptionsTotal)} en total`} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-base font-semibold text-navy">Necesitan atención</h2>
      {attention.length === 0 ? (
        <EmptyState title="Todo en orden" text="Ningún plan vence pronto y no hay invitaciones pendientes." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {attention.map(({ row, reason, label }) => (
              <li key={row.business.id}>
                <Link href={`/admin/negocios/${row.business.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 hover:bg-surface focus-visible:bg-surface focus-visible:outline-none">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy">{displayName(row.business)}</span>
                    <span className="block truncate text-xs text-muted">{row.owner?.email ?? 'Sin dueño con correo'}</span>
                  </span>
                  <Badge tone={REASON[reason].tone}>{REASON[reason].text}</Badge>
                  <span className="w-full text-xs text-muted sm:w-auto">{reason === 'invite' ? 'Aún no crea su contraseña' : label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
