import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AdminInsights, SeriesPoint } from '@/lib/contracts';
import { Card } from '@/components/ui';
import { BarChart, LineChart, peakIndex } from '@/components/dashboard';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { SectionHeader, focusRing } from './bits';
import type { DaysRange } from './helpers';

/** Selector 30/90 días por enlaces (?rango=30|90), funciona sin JavaScript. */
function RangeToggle({ current }: { current: DaysRange }) {
  return (
    <nav aria-label="Rango de las gráficas de uso" className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-[#C9D6E3]">
      {([30, 90] as DaysRange[]).map((r) => (
        <Link key={r} href={`/admin?rango=${r}`} scroll={false} aria-current={r === current ? 'page' : undefined}
          className={cn('inline-flex min-h-[44px] items-center rounded-full px-4 text-[13px] font-semibold transition',
            r === current ? 'bg-navy text-white' : 'text-navy hover:bg-surface', focusRing)}>
          {r} días
        </Link>
      ))}
    </nav>
  );
}

function barDesc(what: string, unit: string, points: SeriesPoint[]): string {
  const total = points.reduce((a, p) => a + p.value, 0);
  if (total === 0) return `${what}: ninguno en este periodo.`;
  const peak = peakIndex(points.map((p) => p.value));
  return `${what}: ${num(total)} en total. El más alto fue ${points[peak].label}, con ${num(points[peak].value)} ${unit}. Detalle: ${points.map((p) => `${p.label}, ${num(p.value)}`).join('; ')}.`;
}

function ChartCard({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-navy">{title}</h3>
        <span className="text-xs text-muted">{note}</span>
      </div>
      {children}
    </Card>
  );
}

/** Crecimiento y uso: negocios nuevos, clientes nuevos, sellos y canjes por día. */
export function GrowthSection({ series, range }: { series: AdminInsights['series']; range: DaysRange }) {
  const biz = series.businessesByMonth;
  const cust = series.customersByWeek;
  const stamps = series.stampsByDay.slice(-range);
  const redeems = series.redemptionsByDay.slice(-range);
  const sum = (p: SeriesPoint[]) => p.reduce((a, x) => a + x.value, 0);

  return (
    <section aria-labelledby="crecimiento-t" id="crecimiento" className="scroll-mt-6">
      <SectionHeader id="crecimiento-t" title="Crecimiento" text="Negocios y clientes nuevos en Stampa." />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ChartCard title="Negocios nuevos por mes" note={`12 meses · ${num(sum(biz))}`}>
          <BarChart id="neg-mes" title="Negocios nuevos por mes, últimos 12 meses" desc={barDesc('Negocios nuevos por mes', 'negocios', biz)}
            items={biz.map((p) => ({ label: p.label.split(' ')[0], value: p.value, tooltip: `${p.label}: ${num(p.value)}` }))}
            highlight={peakIndex(biz.map((p) => p.value))} />
        </ChartCard>
        <ChartCard title="Clientes nuevos por semana" note={`12 semanas · ${num(sum(cust))}`}>
          <BarChart id="cli-sem" title="Clientes nuevos por semana, últimas 12 semanas" desc={barDesc('Clientes nuevos por semana (semana que empieza el)', 'clientes', cust)}
            items={cust.map((p) => ({ label: p.label, value: p.value, tooltip: `Semana del ${p.label}: ${num(p.value)}` }))}
            highlight={peakIndex(cust.map((p) => p.value))} labelEvery={3} />
        </ChartCard>
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-navy">Sellos y canjes por día</h3>
          <p className="text-sm text-muted">En todos los negocios, últimos {range} días.</p>
        </div>
        <RangeToggle current={range} />
      </div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <ChartCard title="Sellos" note={`${num(sum(stamps))} en ${range} días`}>
          <LineChart id="sellos-dia" title={`Sellos por día, últimos ${range} días`} unit="sellos" data={stamps} />
        </ChartCard>
        <ChartCard title="Canjes" note={`${num(sum(redeems))} en ${range} días`}>
          <LineChart id="canjes-dia" title={`Canjes por día, últimos ${range} días`} unit="canjes" data={redeems} />
        </ChartCard>
      </div>
    </section>
  );
}
