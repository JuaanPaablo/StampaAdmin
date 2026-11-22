import { pendingRewards } from '@/lib/rewards';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import type { Alert, RangeKey } from '@/lib/contracts';
import { ago, localizeTicket, num, pct } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader, btnClass } from '@/components/ui';
import {
  BarChart, KpiCard, LineChart, RangeTabs, WEEKDAYS, MONTHS_FULL, RANGE_LABEL,
  cap, dayLabel, delta, hourLabel, hourPhrase, peakIndex
} from '@/components/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resumen · Stampa' };

const SEVERITY: Record<Alert['severity'], { tone: 'info' | 'warn' | 'bad'; label: string }> = {
  info: { tone: 'info', label: 'Aviso' }, warning: { tone: 'warn', label: 'Atención' }, critical: { tone: 'bad', label: 'Crítica' }
};

function greeting(timezone: string): string {
  let h = 12;
  try {
    h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date())) % 24;
  } catch { /* zona inválida: usa mediodía */ }
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default async function ResumenPage({ searchParams }: { searchParams: { rango?: string } }) {
  const range: RangeKey = searchParams.rango === '7d' || searchParams.rango === '90d' ? searchParams.rango : '30d';
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, program, template, staff } = ctx;
  const v = template.vocab;
  const [dash, redeemable, alerts] = await Promise.all([
    repo.getDashboard(business.id, range),
    repo.listRedeemable(business.id),
    repo.listAlerts(business.id, 3)
  ]);
  const now = Date.now();
  const k = dash.kpis, p = dash.previous;
  const prevHint = `frente a los ${RANGE_LABEL[range]} anteriores`;
  const hasActivity = dash.series.some((s) => s.stamps > 0 || s.newCustomers > 0) || k.stampsIssued > 0;

  /* Horas: se recorta a la franja con movimiento (con un mínimo de 8 barras). */
  const hourVals = dash.byHour.map((h) => h.stamps);
  const nonZero = dash.byHour.filter((h) => h.stamps > 0).map((h) => h.hour);
  let hFrom = nonZero.length ? Math.min(...nonZero) - 1 : 8;
  let hTo = nonZero.length ? Math.max(...nonZero) + 1 : 20;
  hFrom = Math.max(0, hFrom); hTo = Math.min(23, hTo);
  while (hTo - hFrom < 7) { if (hFrom > 0) hFrom--; if (hTo - hFrom < 7 && hTo < 23) hTo++; if (hFrom === 0 && hTo === 23) break; }
  const hours = dash.byHour.filter((h) => h.hour >= hFrom && h.hour <= hTo);
  const hPeakAll = peakIndex(hourVals);
  const hPeakHour = hPeakAll >= 0 ? dash.byHour[hPeakAll].hour : -1;
  const hPeak = hours.findIndex((h) => h.hour === hPeakHour);

  const wdVals = dash.byWeekday.map((w) => w.stamps);
  const wdPeak = peakIndex(wdVals);
  const wdOrder = [1, 2, 3, 4, 5, 6, 0]; // semana que empieza en lunes
  const weekdays = wdOrder.map((d) => dash.byWeekday.find((w) => w.weekday === d) ?? { weekday: d, stamps: 0 });
  const wdPeakIdx = wdPeak >= 0 ? weekdays.findIndex((w) => w.weekday === dash.byWeekday[wdPeak].weekday) : -1;

  const hourSentence = hPeak >= 0
    ? `Tu hora más fuerte ${hPeakHour === 1 ? 'es' : 'son'} ${hourPhrase(hPeakHour)}, con ${num(hours[hPeak].stamps)} sellos.`
    : 'Aún no hay suficientes sellos para saber tu hora más fuerte.';
  const dayName = wdPeakIdx >= 0 ? WEEKDAYS[weekdays[wdPeakIdx].weekday] : '';
  const daySentence = wdPeakIdx >= 0
    ? `Tu día más fuerte es el ${dayName}, con ${num(weekdays[wdPeakIdx].stamps)} sellos.`
    : 'Aún no hay suficientes sellos para saber tu día más fuerte.';

  const customersCap = cap(v.customers);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(business.timezone)}, ${staff.name.split(' ')[0]}`}
        subtitle={`Así va ${business.name} en los últimos ${RANGE_LABEL[range]}.`}
        actions={<RangeTabs current={range} />}
      />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <KpiCard label="Sellos entregados" value={num(k.stampsIssued)} delta={delta(k.stampsIssued, p.stampsIssued)} hint={prevHint} />
        <KpiCard label={`${customersCap} activos`} value={num(k.activeCustomers)} delta={delta(k.activeCustomers, p.activeCustomers)} hint={prevHint} />
        <KpiCard label={`${customersCap} nuevos`} value={num(k.newCustomers)} delta={delta(k.newCustomers, p.newCustomers)} hint={prevHint} />
        <KpiCard label={`${cap(v.reward)}s canjeados`} value={num(k.rewardsRedeemed)} delta={delta(k.rewardsRedeemed, p.rewardsRedeemed)} hint={prevHint} />
        <KpiCard label="Tasa de regreso" value={pct(k.returnRate)} hint={`${v.customers} con 2 o más ${v.visits}`} />
        <KpiCard label={`Sellos por ${v.ticket.toLowerCase()}`} value={num(k.stampsPerTicket, 1)} hint="promedio del periodo" />
      </section>

      {!hasActivity ? (
        <EmptyState
          title="Todavía no hay movimiento en este periodo"
          text={`Cuando tus ${v.customers} empiecen a sumar sellos, aquí verás cómo van tus ${v.visits}, quiénes regresan y a qué hora llegan. Prueba con un rango más amplio o genera el primer código en ${v.counter.toLowerCase()}.`}
          action={<Link href="/panel/caja" className={btnClass('primary', 'sm')}>Ir a {v.counter.toLowerCase()}</Link>}
        />
      ) : (
        <section aria-label="Tendencia" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-display text-base font-semibold text-navy">Sellos por día</h2>
            <p className="mb-3 text-xs text-muted">Cada punto es un día. El amarillo marca el día más alto.</p>
            <LineChart id="ln-sellos" title="Sellos por día" unit="sellos"
              data={dash.series.map((s) => ({ label: dayLabel(s.date), value: s.stamps }))} />
          </Card>
          <Card>
            <h2 className="font-display text-base font-semibold text-navy">{customersCap} nuevos por día</h2>
            <p className="mb-3 text-xs text-muted">Personas que se registraron por primera vez.</p>
            <LineChart id="ln-nuevos" title={`${customersCap} nuevos por día`} unit={v.customers}
              data={dash.series.map((s) => ({ label: dayLabel(s.date), value: s.newCustomers }))} />
          </Card>
        </section>
      )}

      <section aria-labelledby="cuando" className="grid gap-4 lg:grid-cols-2">
        <h2 id="cuando" className="sr-only">¿Cuándo viene tu gente?</h2>
        <Card>
          <h3 className="font-display text-base font-semibold text-navy">¿Cuándo viene tu gente? Por hora</h3>
          <p className="mb-3 text-sm font-medium text-navy">{hourSentence}</p>
          <BarChart id="bar-hora" title="Sellos por hora del día" desc={hourSentence}
            items={hours.map((h) => ({ label: String(h.hour), value: h.stamps, tooltip: `${hourLabel(h.hour)}: ${num(h.stamps)} sellos` }))}
            highlight={hPeak} labelEvery={hours.length > 12 ? 2 : 1} />
          <p className="mt-1 text-xs text-muted">Hora del día, de 0 a 23.</p>
        </Card>
        <Card>
          <h3 className="font-display text-base font-semibold text-navy">¿Cuándo viene tu gente? Por día</h3>
          <p className="mb-3 text-sm font-medium text-navy">{daySentence}</p>
          <BarChart id="bar-dia" title="Sellos por día de la semana" desc={daySentence}
            items={weekdays.map((w) => ({ label: WEEKDAYS[w.weekday].slice(0, 3), value: w.stamps, tooltip: `${cap(WEEKDAYS[w.weekday])}: ${num(w.stamps)} sellos` }))}
            highlight={wdPeakIdx} />
          <p className="mt-1 text-xs text-muted">De lunes a domingo.</p>
        </Card>
      </section>

      <section aria-label="Personas y premios" className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="font-display text-base font-semibold text-navy">Mejores {v.customers}</h2>
          {dash.topCustomers.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aún no hay {v.customers} con sellos en este periodo.</p>
          ) : (
            <ol className="mt-3 divide-y divide-line/80">
              {dash.topCustomers.slice(0, 5).map((c, i) => (
                <li key={c.customerId}>
                  <Link href={`/panel/clientes/${c.customerId}`} className="flex items-center gap-3 py-2.5 hover:bg-surface/70 focus-visible:bg-surface/70">
                    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold text-navy">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy">{c.name}</span>
                    <span className="text-sm tabular-nums text-muted">{num(c.stamps)} sellos</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-navy">Cumpleaños próximos</h2>
          {program.birthdayReward && <p className="mt-1 text-xs text-muted">Regalo: {program.birthdayReward}</p>}
          {dash.upcomingBirthdays.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No hay cumpleaños en los próximos días.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/80">
              {dash.upcomingBirthdays.slice(0, 5).map((b) => (
                <li key={b.customerId}>
                  <Link href={`/panel/clientes/${b.customerId}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface/70 focus-visible:bg-surface/70">
                    <span className="min-w-0 truncate text-sm font-medium text-navy">{b.name}</span>
                    <span className="shrink-0 text-sm text-muted">{b.d} de {MONTHS_FULL[b.m]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-navy">Listos para canjear</h2>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-navy">{num(redeemable.length)}</p>
          <p className="text-xs text-muted">{redeemable.length === 1 ? v.customer + ' tiene' : v.customers + ' tienen'} un premio por entregar.</p>
          {redeemable.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-navy">
              {redeemable.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link href={`/panel/clientes/${c.id}`} className="truncate font-medium underline-offset-2 hover:underline">{c.name}</Link>
                  <span className="shrink-0 truncate text-xs text-muted">{pendingRewards(c, program).map((p) => p.title).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/panel/caja#premios" className={btnClass(redeemable.length ? 'primary' : 'ghost', 'sm') + ' mt-4'}>Ir a canjear</Link>
        </Card>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-navy">Alertas recientes</h2>
          <Link href="/panel/control" className="text-sm font-semibold text-navy underline underline-offset-4">Ver control</Link>
        </div>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin alertas. Todo marcha con normalidad.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/80">
            {alerts.slice(0, 3).map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <span className="w-[4.5rem] shrink-0"><Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge></span>
                <span className="min-w-0 flex-1 basis-60 text-sm text-navy">{localizeTicket(a.message, template.vocab.ticket)}</span>
                <span className="text-xs text-muted">{ago(a.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
