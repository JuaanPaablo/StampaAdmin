import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Card, btnClass } from '@/components/ui';
import { KpiCard } from '@/components/dashboard';
import { PlanForm, ResendAccess, StatusControl } from '@/components/admin/DetailActions';
import { ExpiryText, StatusBadge } from '@/components/admin/StatusBadge';
import { displayName, formatDate, formatDateTime, lastStampText, amountInput, ownerWhatsappText, relativeTime, toDateInput } from '@/components/admin/helpers';
import { HealthBadge } from '@/components/admin/business/HealthBadge';
import { ActivityChart, parseDetailRange } from '@/components/admin/business/ActivityChart';
import { PaymentForm } from '@/components/admin/business/PaymentForm';
import { OwnerPhoneForm } from '@/components/admin/business/OwnerPhoneForm';
import { ActionTimeline, AiUsage, AlertsSummary, LocationList, PaymentHistory, StaffList } from '@/components/admin/business/DetailSections';
import { requireAdmin } from '@/lib/admin-session';
import { planPriceCents } from '@/lib/domain/admin-insights';
import { num } from '@/lib/format';
import { PLANS, PLAN_LABEL, businessStatus } from '@/lib/mvp-rules';
import { planPrice } from '@/lib/plans';
import { getTemplate } from '@/lib/templates';
import { customerUrl, ownerWhatsappUrl } from '@/lib/urls';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-3 border-b border-line/70 py-2.5 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold tracking-wide text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-navy">{children}</dd>
    </div>
  );
}

/** Tarjeta con título y ancla para la navegación de la ficha. */
function Section({ id, title, children, action, className }: { id?: string; title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Card className={cn('scroll-mt-20', className)}>
      <div id={id} className="mb-4 flex flex-wrap items-center justify-between gap-2 scroll-mt-20">
        <h2 className="font-display text-base font-semibold text-navy">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

const SECTIONS = [
  { id: 'actividad', label: 'Actividad' }, { id: 'pagos', label: 'Pagos' }, { id: 'plan', label: 'Plan' },
  { id: 'duenio', label: 'Dueño' }, { id: 'equipo', label: 'Equipo' }, { id: 'alertas', label: 'Alertas' },
  { id: 'ia', label: 'IA' }, { id: 'historial', label: 'Historial' }
];

export default async function AdminBusinessPage({ params, searchParams }: {
  params: { id: string }; searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { repo } = await requireAdmin();
  const id = decodeURIComponent(params.id).slice(0, 128);
  const detail = await repo.getAdminBusinessDetail(id);
  if (!detail) notFound();
  const { row, health, daysSinceLastStamp } = detail;
  const { business: b, owner, stats, note } = row;
  const st = businessStatus(b);
  const now = Date.now();
  const name = displayName(b);
  const range = parseDetailRange(searchParams?.rango);
  const basePath = `/admin/negocios/${encodeURIComponent(b.id)}`;
  const wa = ownerWhatsappUrl(row.ownerPhone, ownerWhatsappText(row, now));
  const mail = owner?.email ? `mailto:${owner.email}?subject=${encodeURIComponent(`Stampa · ${name}`)}` : null;
  const owners = detail.staff.filter((s) => s.role === 'owner').length;

  return (
    <>
      <Link href="/admin/negocios" className="mb-3 inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium text-muted hover:text-navy">← Negocios</Link>

      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl font-bold tracking-tight text-navy sm:text-[28px]">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge business={b} />
            <HealthBadge health={health} prefix="Actividad:" detail={health !== 'none' ? (stats.lastStampAt ? `último sello ${lastStampText(stats.lastStampAt, now)}` : 'nunca selló') : undefined} />
            <span className="text-sm text-navy">Plan {PLAN_LABEL[b.plan]}</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <ExpiryText planExpiresAt={b.planExpiresAt} autoRenew={b.autoRenew} now={now} />
          </div>
          {st === 'setup' && (
            <p className="mt-2 max-w-2xl text-sm text-muted">{owner?.invitePending ? 'El dueño aún no crea su contraseña.' : 'El dueño está en el asistente de configuración.'}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={btnClass('primary')}>
              WhatsApp<span className="sr-only"> al dueño (abre en otra pestaña)</span>
            </a>
          ) : (
            <a href="#duenio" className={btnClass('ghost')}>Agregar celular</a>
          )}
          {mail && <a href={mail} className={btnClass('ghost')}>Correo<span className="sr-only"> al dueño</span></a>}
          {st === 'active' && (
            <a href={customerUrl(b.slug)} target="_blank" rel="noopener noreferrer" className={btnClass('ghost') + ' col-span-2'}>
              Ver página del cliente<span className="sr-only"> (abre en otra pestaña)</span>
            </a>
          )}
        </div>
      </header>

      <nav aria-label="Secciones de la ficha" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full bg-white px-4 text-[13px] font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard label="Clientes" value={num(detail.customers)} />
        <KpiCard label="Sellos 30 días" value={num(stats.stamps30d)} hint={stats.stamps7d !== undefined ? `${num(stats.stamps7d)} en 7 días` : undefined} />
        <KpiCard label="Canjes 30 días" value={num(stats.redemptions30d)} />
        <KpiCard label="Última actividad" value={<span className="text-xl sm:text-2xl">{stats.lastActivityAt ? relativeTime(stats.lastActivityAt, now) : 'Ninguna'}</span>}
          hint={stats.lastActivityAt ? formatDate(stats.lastActivityAt) : undefined} />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard label="Días sin sellos" value={daysSinceLastStamp === null ? <span className="text-xl sm:text-2xl">Nunca selló</span> : num(daysSinceLastStamp)}
            hint={stats.lastStampAt ? `Último: ${formatDate(stats.lastStampAt)}` : undefined} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-6">
        {/* Columna principal: actividad, cobros, plan e historial */}
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <Section id="actividad" title="Actividad">
            <ActivityChart basePath={basePath} range={range} stamps={detail.stampsByDay} redemptions={detail.redemptionsByDay} />
          </Section>

          <Section id="pagos" title="Pagos">
            <h3 className="mb-3 text-sm font-semibold text-navy">Registrar pago</h3>
            <PaymentForm businessId={b.id} defaultAmount={amountInput(planPriceCents(b.plan))} currentExpiresAt={b.planExpiresAt} />
            <h3 className="mb-2 mt-6 border-t border-line pt-5 text-sm font-semibold text-navy">
              Pagos registrados{detail.payments.length > 0 && <span className="font-normal text-muted"> · {num(detail.payments.length)}</span>}
            </h3>
            <PaymentHistory payments={detail.payments} />
          </Section>

          <Section id="plan" title="Plan y vencimiento">
            <PlanForm
              key={`${b.plan}|${b.planExpiresAt ?? ''}|${b.autoRenew ? 1 : 0}`}
              businessId={b.id} plan={b.plan} expires={toDateInput(b.planExpiresAt)} note={note ?? ''} autoRenew={b.autoRenew}
              plans={PLANS.map((p) => ({ value: p, label: `${PLAN_LABEL[p]} · ${planPrice(p)}` }))}
            />
          </Section>

          <Section id="historial" title="Historial">
            <ActionTimeline actions={detail.actions} now={now} />
          </Section>
        </div>

        {/* Columna lateral: datos, dueño, equipo, alertas, IA */}
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <Section title="Datos del negocio">
            <dl>
              <Row label="Tipo">{st === 'setup' && b.type === 'otro' ? 'Sin elegir' : getTemplate(b.type).label}</Row>
              {b.city && <Row label="Ciudad">{[b.city, b.province].filter(Boolean).join(', ')}</Row>}
              <Row label="Dirección pública"><span className="font-mono text-[13px]">/u/{b.slug}</span>{st === 'setup' && <span className="text-muted"> (provisional)</span>}</Row>
              <Row label="Acceso creado">{formatDate(b.createdAt)}</Row>
              {b.setupCompletedAt && <Row label="Configurado">{formatDate(b.setupCompletedAt)}</Row>}
              {b.suspendedAt && st === 'suspended' && <Row label="Suspendido">{formatDate(b.suspendedAt)}</Row>}
              {detail.program && <Row label="Programa">{detail.program.rewardTitle ? `${detail.program.stampsRequired} sellos · ${detail.program.rewardTitle}` : `${detail.program.stampsRequired} sellos`}</Row>}
              {note && <Row label="Nota interna"><span className="whitespace-pre-line">{note}</span></Row>}
            </dl>
          </Section>

          <Section id="duenio" title="Dueño">
            {owner ? (
              <dl>
                <Row label="Nombre">{owner.name}</Row>
                <Row label="Correo">{owner.email ? <a href={mail ?? undefined} className="break-all text-navy underline underline-offset-2">{owner.email}</a> : 'Sin correo'}</Row>
                <Row label="Acceso">
                  {owner.invitePending ? 'Invitación pendiente' : 'Con contraseña'}
                  {owner.invitePending && row.inviteExpiresAt && (
                    <span className="block text-xs text-muted">
                      {Date.parse(row.inviteExpiresAt) <= now ? 'El enlace venció el ' : 'El enlace vence el '}{formatDateTime(row.inviteExpiresAt)}
                    </span>
                  )}
                </Row>
              </dl>
            ) : <p className="text-sm text-muted">Este negocio no tiene dueño registrado.</p>}
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="mb-2 text-sm font-semibold text-navy">Celular (WhatsApp)</h3>
              <OwnerPhoneForm businessId={b.id} phone={row.ownerPhone} />
            </div>
            {owner?.email && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="mb-2 text-sm font-semibold text-navy">Reenviar acceso</h3>
                <ResendAccess businessId={b.id} invitePending={owner.invitePending} email={owner.email} />
              </div>
            )}
          </Section>

          <Section id="alertas" title="Alertas">
            <AlertsSummary alerts={detail.alerts} now={now} />
          </Section>

          <Section id="ia" title="IA este mes">
            <AiUsage ai={detail.ai} plan={b.plan} />
          </Section>

          <Section id="equipo" title="Equipo" action={<span className="text-xs text-muted">{num(detail.staff.length)} {detail.staff.length === 1 ? 'persona' : 'personas'}{owners > 1 ? ` · ${owners} dueños` : ''}</span>}>
            <StaffList staff={detail.staff} />
          </Section>

          <Section title="Sucursales" action={<span className="text-xs text-muted">{num(detail.locations.length)}</span>}>
            <LocationList locations={detail.locations} />
          </Section>

          <Section title={st === 'suspended' ? 'Reactivar' : 'Suspender'}>
            <StatusControl businessId={b.id} status={st} name={name} />
          </Section>
        </div>
      </div>
    </>
  );
}
