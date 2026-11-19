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

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Control · Stampa' };

const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '90d': 90 };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id + '-h'} className="scroll-mt-6">
      <h2 id={id + '-h'} className="font-display text-lg font-semibold text-navy">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-sm text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

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

  const [alertsAll, report, codes, audit, staffList] = await Promise.all([
    repo.listAlerts(business.id, 200),
    repo.getStaffReport(business.id, range),
    repo.listStampCodes(business.id, 15),
    repo.listAudit(business.id, 500),
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
  const filtered = (accion ? audit.filter((e) => e.action === accion) : audit).slice(0, 50);
  const rangeLabel = range === '7d' ? 'los últimos 7 días' : range === '30d' ? 'los últimos 30 días' : 'los últimos 90 días';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <PageHeader title="Control" subtitle={'Qué pasa en ' + v.counter.toLowerCase() + ' de ' + business.name + ': alertas, equipo y registro de actividad.'}
        actions={<RangeTabs range={range} accion={accion || undefined} />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="region" aria-label={'Resumen de ' + rangeLabel}>
        <Stat label="Alertas críticas" value={critical} hint={'en ' + rangeLabel} />
        <Stat label="Advertencias" value={warning} hint={'en ' + rangeLabel} />
        <Stat label="Personas a revisar" value={flagged} hint={flagged === 0 ? 'Nadie fuera de lo normal' : 'Sellos por ' + v.ticket.toLowerCase() + ' muy altos'} />
      </div>

      <Section id="alertas" title="Alertas">
        <AlertList alerts={alerts.slice(0, 30)} staffNames={staffNames} range={range} ticketWord={v.ticket}
          emptyText="No hubo códigos compartidos, aprobaciones ni anulaciones sospechosas. Si algo cambia, lo verás aquí primero." />
      </Section>

      <Section id="cajeros" title={'Equipo en ' + v.counter.toLowerCase()} hint={'Cuántos sellos da cada ' + v.staffRole + ' por ' + v.ticket.toLowerCase() + ', frente al resto del equipo.'}>
        <StaffTable rows={report} ticketPlural={plural(v.ticket)} staffWord={v.staffRole} ticketWord={v.ticket} />
      </Section>

      <Section id="codigos" title="Códigos recientes">
        <CodesTable codes={codes} statuses={statuses} staffNames={staffNames} showAmount={program.requireAmount} ticketWord={v.ticket} staffWord={v.staffRole} />
      </Section>

      <Section id="reglas" title="Reglas activas" hint="Lo que el sistema exige hoy a cada código.">
        <RulesCard program={program} customerWord={v.customer} />
      </Section>

      <Section id="actividad" title="Registro de actividad">
        <AuditSection entries={filtered} actions={actions} selected={accion} range={range} staffNames={staffNames} timezone={business.timezone}
          vocab={{ reward: v.reward, ticket: v.ticket }} />
      </Section>
    </div>
  );
}
