import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Card, PageHeader, Stat, btnClass } from '@/components/ui';
import { PlanForm, ResendAccess, StatusControl } from '@/components/admin/DetailActions';
import { ExpiryText, StatusBadge } from '@/components/admin/StatusBadge';
import { displayName, formatDate, toDateInput } from '@/components/admin/helpers';
import { requireAdmin } from '@/lib/admin-session';
import { ago, num } from '@/lib/format';
import { PLANS, PLAN_LABEL, businessStatus } from '@/lib/mvp-rules';
import { getTemplate } from '@/lib/templates';
import { customerUrl } from '@/lib/urls';

export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line/70 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-xs font-semibold tracking-wide text-muted sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-navy">{children}</dd>
    </div>
  );
}

export default async function AdminBusinessPage({ params }: { params: { id: string } }) {
  const { repo } = await requireAdmin();
  const row = await repo.getAdminBusiness(decodeURIComponent(params.id).slice(0, 128));
  if (!row) notFound();
  const { business: b, owner, stats, note } = row;
  const st = businessStatus(b);
  const now = Date.now();
  const name = displayName(b);

  return (
    <>
      <Link href="/admin/negocios" className="mb-3 inline-flex items-center gap-1 rounded text-sm font-medium text-muted hover:text-navy">← Negocios</Link>
      <PageHeader
        title={name}
        subtitle={st === 'setup' ? 'El dueño todavía no termina de configurar su negocio.' : undefined}
        actions={st === 'active' ? (
          <a href={customerUrl(b.slug)} target="_blank" rel="noopener noreferrer" className={btnClass('ghost')}>Ver página del cliente</a>
        ) : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Clientes" value={num(stats.customers)} />
        <Stat label="Sellos 30 días" value={num(stats.stamps30d)} />
        <Stat label="Canjes 30 días" value={num(stats.redemptions30d)} />
        <Stat label="Última actividad" value={<span className="text-xl">{stats.lastActivityAt ? ago(stats.lastActivityAt, now) : 'Ninguna'}</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold text-navy">Datos del negocio</h2>
          <dl>
            <Row label="Estado"><StatusBadge business={b} /></Row>
            <Row label="Plan">{PLAN_LABEL[b.plan]}</Row>
            <Row label="Vencimiento"><ExpiryText planExpiresAt={b.planExpiresAt} autoRenew={b.autoRenew} now={now} /></Row>
            <Row label="Tipo">{st === 'setup' && b.type === 'otro' ? 'Sin elegir' : getTemplate(b.type).label}</Row>
            {b.city && <Row label="Ciudad">{[b.city, b.province].filter(Boolean).join(", ")}</Row>}
            <Row label="Dirección pública"><span className="font-mono text-[13px]">/u/{b.slug}</span>{st === 'setup' && <span className="text-muted"> (provisional)</span>}</Row>
            <Row label="Acceso creado">{formatDate(b.createdAt)}</Row>
            {b.setupCompletedAt && <Row label="Configurado">{formatDate(b.setupCompletedAt)}</Row>}
            {b.suspendedAt && st === 'suspended' && <Row label="Suspendido">{formatDate(b.suspendedAt)}</Row>}
            {note && <Row label="Nota interna"><span className="whitespace-pre-line">{note}</span></Row>}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-semibold text-navy">Dueño</h2>
          {owner ? (
            <dl>
              <Row label="Nombre">{owner.name}</Row>
              <Row label="Correo">{owner.email ?? 'Sin correo'}</Row>
              <Row label="Acceso">{owner.invitePending ? 'Invitación pendiente: aún no crea su contraseña' : 'Ya entró y tiene contraseña'}</Row>
            </dl>
          ) : <p className="text-sm text-muted">Este negocio no tiene dueño registrado.</p>}
          {owner?.email && (
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="mb-2 text-sm font-semibold text-navy">Reenviar acceso</h3>
              <ResendAccess businessId={b.id} invitePending={owner.invitePending} email={owner.email} />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-base font-semibold text-navy">Plan y vencimiento</h2>
          <PlanForm
            businessId={b.id} plan={b.plan} expires={toDateInput(b.planExpiresAt)} note={note ?? ''} autoRenew={b.autoRenew}
            plans={PLANS.map((p) => ({ value: p, label: PLAN_LABEL[p] }))}
          />
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-semibold text-navy">{st === 'suspended' ? 'Reactivar' : 'Suspender'}</h2>
          <StatusControl businessId={b.id} status={st} name={name} />
        </Card>
      </div>
    </>
  );
}
