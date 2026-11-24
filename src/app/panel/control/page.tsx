import { features } from '@/lib/plans';
import { PlanLock } from '@/components/shell/PlanLock';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { codeStatus } from '@/lib/domain';
import type { CodeStatus, RangeKey } from '@/lib/contracts';
import { AlertList } from '@/components/control/AlertList';
import { AuditSection } from '@/components/control/AuditSection';
import { CodesTable } from '@/components/control/CodesTable';
import { RangeTabs } from '@/components/control/RangeTabs';
import { RulesCard } from '@/components/control/RulesCard';
import { StaffTable } from '@/components/control/StaffTable';
import { plural } from '@/components/register/time';
import { RANGE_DAYS, RANGE_LABEL, rangeDates } from '@/components/dashboard/helpers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Control · Stampa' };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id + '-h'} className="scroll-mt-6">
      <h2 id={id + '-h'} className="font-display text-lg font-semibold text-navy">{title}</h2>
      {hint ? <p className="mb-3 mt-0.5 text-sm text-muted">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

const AUDIT_PAGE_SIZE = 20;
const ALERTS_SHOWN = 30;
const CODES_SHOWN = 15;

export default async function ControlPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, program, template, staff } = ctx;
  const v = template.vocab;

  if (staff.role === 'cashier') {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Control" />
        <EmptyState title="Esta sección es para dueño y gerente" text={'Pídele a un gerente que revise el control antifraude. Tú puedes seguir atendiendo en ' + v.counter.toLowerCase() + '.'} />
      </div>
    );
  }

  const rawRange = first(searchParams.range);
  const range: RangeKey = rawRange === '30d' || rawRange === '90d' ? rawRange : '7d';
  const accion = (first(searchParams.accion) ?? '').slice(0, 60);

  const plan = features(business.plan);
  const [alertsAll, report, codes, audit, staffList] = await Promise.all([
    plan.alerts ? repo.listAlerts(business.id, 200) : Promise.resolve([]),
    plan.staffReport ? repo.getStaffReport(business.id, range) : Promise.resolve([]),
    repo.listStampCodes(business.id, CODES_SHOWN),
    repo.listAudit(business.id, 1000),
    repo.listStaff(business.id)
  ]);

  const now = new Date();
  const since = now.getTime() - RANGE_DAYS[range] * 86_400_000;
  const alerts = alertsAll.filter((a) => new Date(a.at).getTime() >= since).sort((a, b) => b.at.localeCompare(a.at));
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;
  const flagged = report.filter((r) => r.flagged).length;
  const staffNames = Object.fromEntries(staffList.map((s) => [s.id, s.name]));
  const statuses: Record<string, CodeStatus> = Object.fromEntries(codes.map((c) => [c.id, codeStatus(c, now)]));

  const actions = Array.from(new Set(audit.map((e) => e.action))).sort();
  const matching = accion ? audit.filter((e) => e.action === accion) : audit;
  const pages = Math.max(1, Math.ceil(matching.length / AUDIT_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(first(searchParams.pagina) ?? '1', 10) || 1));
  const filtered = matching.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE);
  const days = RANGE_LABEL[range];
  const rangeLabel = 'los últimos ' + days;
  const staffWord = v.staffRole;

  /* Atajos para saltar entre secciones: la página es larga en el celular. */
  const jumps = [
    { id: 'alertas', label: 'Alertas' + (plan.alerts && alerts.length ? ` (${alerts.length})` : '') },
    { id: 'cajeros', label: 'Equipo' },
    { id: 'codigos', label: 'Códigos' },
    { id: 'reglas', label: 'Reglas' },
    { id: 'actividad', label: 'Historial' }
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageHeader title="Control"
          subtitle={`Últimos ${days} (${rangeDates(range, business.timezone)})`}
          actions={<RangeTabs range={range} accion={accion || undefined} />} />
        <nav aria-label="Secciones de control" className="-mt-6 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {jumps.map((j) => (
            <a key={j.id} href={'#' + j.id}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-full px-3 text-sm font-semibold text-navy underline-offset-4 hover:bg-surface hover:underline">
              {j.label}
            </a>
          ))}
        </nav>
      </div>

      {plan.alerts && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="region" aria-label={'Resumen de ' + rangeLabel}>
        <Stat label="Urgentes" value={critical} hint={critical === 0 ? 'Nada urgente' : 'Atiéndelas hoy'} />
        <Stat label="Para revisar" value={warning} hint={warning === 0 ? 'Nada pendiente' : 'Revísalas esta semana'} />
        <Stat label="Personas a revisar" value={plan.staffReport ? flagged : '—'}
          hint={!plan.staffReport ? 'Disponible en plan Pro' : flagged === 0 ? 'Todos dentro de lo normal' : 'Dan más sellos por ' + v.ticket.toLowerCase() + ' que el resto'} />
      </div>
      )}

      <Section id="alertas" title="Alertas" hint={plan.alerts && alerts.length ? 'Cada alerta dice qué pasó y qué hacer. Las urgentes van primero.' : undefined}>
        {plan.alerts ? (
        <AlertList alerts={alerts} limit={ALERTS_SHOWN} staffNames={staffNames} range={range} ticketWord={v.ticket}
          canSeeStaff={plan.staffReport} emptyText={`Nada raro en ${rangeLabel}.`} />
        ) : (
        <PlanLock plan="standard" businessName={business.name} title="Alertas antifraude"
          text="Códigos compartidos, tickets repetidos y anulaciones sospechosas." />
        )}
      </Section>

      <Section id="cajeros" title={'Equipo en ' + v.counter.toLowerCase()}
        hint={plan.staffReport ? `Sellos por ${v.ticket.toLowerCase()} de cada persona en ${rangeLabel}.` : undefined}>
        {plan.staffReport ? (
        <StaffTable rows={report} ticketPlural={plural(v.ticket)} staffWord={staffWord} ticketWord={v.ticket} />
        ) : (
        <PlanLock plan="pro" businessName={business.name} title={'Reporte por ' + staffWord}
          text={'Sellos por ' + v.ticket.toLowerCase() + ' de cada persona frente al equipo.'} />
        )}
      </Section>

      <Section id="codigos" title="Últimos códigos" hint={`Los ${CODES_SHOWN} más recientes, de cualquier fecha.`}>
        <CodesTable codes={codes} statuses={statuses} staffNames={staffNames} showAmount={program.requireAmount} ticketWord={v.ticket} staffWord={staffWord} />
      </Section>

      <Section id="reglas" title="Reglas activas">
        <RulesCard program={program} customerWord={v.customer} />
      </Section>

      <Section id="actividad" title="Historial de cambios" hint="Quién hizo qué y cuándo, de cualquier fecha.">
        <AuditSection entries={filtered} actions={actions} selected={accion} range={range} staffNames={staffNames} timezone={business.timezone}
          vocab={{ reward: v.reward, ticket: v.ticket }} page={page} pages={pages} total={matching.length} pageSize={AUDIT_PAGE_SIZE} canExport={plan.exportCsv} />
      </Section>
    </div>
  );
}
