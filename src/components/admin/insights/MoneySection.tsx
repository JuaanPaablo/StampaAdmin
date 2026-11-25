import Link from 'next/link';
import type { AdminInsights, MoneyLine } from '@/lib/contracts';
import { ecDateLabel, formatCents } from '@/lib/domain/admin-insights';
import { PLAN_LABEL } from '@/lib/plans';
import { ownerWhatsappUrl } from '@/lib/urls';
import { Badge, Card } from '@/components/ui';
import { KpiCard } from '@/components/dashboard';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { ContactButton, HBar, SectionHeader, ValueBars, countText, focusRing } from './bits';
import { daysLeftLabel, moneyLineMessage } from './helpers';

const LIST_VISIBLE = 5;

function MoneyRow({ line }: { line: MoneyLine }) {
  const wa = ownerWhatsappUrl(line.ownerPhone, moneyLineMessage(line));
  const late = line.days < 0;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={`/admin/negocios/${line.businessId}`} className={cn('-mx-1 flex min-h-[44px] min-w-0 flex-1 flex-col justify-center rounded-lg px-1 hover:bg-surface', focusRing)}>
        <span className="truncate font-semibold text-navy">{line.businessName}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span>{PLAN_LABEL[line.plan]} · {ecDateLabel(line.date)}</span>
          <span className={cn('font-semibold', late ? 'text-[#9B2A22]' : line.days <= 7 ? 'text-[#7A5A00]' : 'text-navy')}>{daysLeftLabel(line.days)}</span>
          {line.autoRenew && !late && <span>Renueva cada mes</span>}
          {line.status === 'suspended' && <Badge>Suspendido</Badge>}
        </span>
      </Link>
      <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-navy">{formatCents(line.amountCents)}</span>
      {wa && <ContactButton compact href={wa} channel="whatsapp" who={line.businessName} />}
    </li>
  );
}

function MoneyList({ id, title, empty, lines, totalCents }: { id: string; title: string; empty: string; lines: MoneyLine[]; totalCents: number }) {
  const visible = lines.slice(0, LIST_VISIBLE);
  const rest = lines.slice(LIST_VISIBLE);
  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="font-display text-base font-semibold text-navy">{title}</h3>
        {lines.length > 0 && <span className="text-xs text-muted">{countText(lines.length, 'negocio', 'negocios')} · {formatCents(totalCents)}</span>}
      </div>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <ul aria-labelledby={id} className="mt-1 divide-y divide-line">
            {visible.map((l) => <MoneyRow key={l.businessId} line={l} />)}
          </ul>
          {rest.length > 0 && (
            <details className="group">
              <summary className={cn('mt-1 flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden', focusRing)}>
                <span className="group-open:hidden">Ver {num(rest.length)} más</span>
                <span className="hidden group-open:inline">Ver menos</span>
                <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {rest.map((l) => <MoneyRow key={l.businessId} line={l} />)}
              </ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

/** Dinero: MRR, cobrado, próximos cobros, ingreso en riesgo, reparto por plan y cobrado por mes. */
export function MoneySection({ money }: { money: AdminInsights['money'] }) {
  const up = money.upcomingRenewals, risk = money.atRisk;
  const maxPlan = Math.max(0, ...money.byPlan.map((p) => p.mrrCents));
  const months = money.collectedByMonth;
  const total6 = months.reduce((a, m) => a + m.value, 0);
  const chartDesc = months.length
    ? `Cobrado por mes: ${months.map((m) => `${m.label}, ${formatCents(m.value)}`).join('; ')}. Total de los ${months.length} meses: ${formatCents(total6)}.`
    : 'Sin cobros registrados.';
  const shortMonth = (label: string) => label.split(' ')[0];

  return (
    <section aria-labelledby="dinero">
      <SectionHeader id="dinero" title="Dinero" text="Montos en dólares, según el precio de cada plan." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard primary label="Ingreso mensual estimado" value={formatCents(money.mrrCents)}
          hint={`${countText(money.payingCount, 'negocio paga', 'negocios pagan')} al día`} />
        <KpiCard label="Cobrado este mes" value={formatCents(money.collectedThisMonthCents)} hint="Pagos registrados" />
        <KpiCard label="Cobros en 30 días" value={formatCents(up.totalCents)} hint={countText(up.items.length, 'negocio', 'negocios')} />
        <KpiCard label="Ingreso en riesgo" value={formatCents(risk.totalCents)}
          hint={risk.items.length ? `${countText(risk.items.length, 'plan vencido', 'planes vencidos')}` : 'Ningún plan vencido'} />
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-2">
          <h3 className="font-display text-base font-semibold text-navy">Por plan</h3>
          <p className="text-xs text-muted">Negocios que pagan y lo que suman al mes.</p>
          <ul className="mt-4 flex flex-col gap-4">
            {money.byPlan.map((p) => (
              <li key={p.plan}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-navy">{p.label} <span className="font-normal text-muted">· {countText(p.count, 'negocio', 'negocios')}</span></span>
                  <span className="font-display font-semibold tabular-nums text-navy">{formatCents(p.mrrCents)}</span>
                </div>
                <HBar value={p.mrrCents} max={maxPlan} tone={p.plan === 'pro' ? 'sun' : 'navy'} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="min-w-0 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-navy">Cobrado por mes</h3>
            <span className="text-xs text-muted">Últimos 6 meses · {formatCents(total6)}</span>
          </div>
          <div className="mt-3">
            <ValueBars id="cobrado-mes" title="Cobrado por mes, últimos 6 meses" desc={chartDesc}
              items={months.map((m) => ({ label: shortMonth(m.label), value: m.value }))}
              format={(v) => formatCents(v).replace(/,00$/, '')} />
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <MoneyList id="renovaciones" title="Próximos cobros" empty="Ningún plan vence en los próximos 30 días." lines={up.items} totalCents={up.totalCents} />
        <MoneyList id="en-riesgo" title="Ingreso en riesgo" empty="No hay planes vencidos. Bien." lines={risk.items} totalCents={risk.totalCents} />
      </div>
    </section>
  );
}
