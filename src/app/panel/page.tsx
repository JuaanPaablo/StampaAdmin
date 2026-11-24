import { features } from '@/lib/plans';
import { PlanLock } from '@/components/shell/PlanLock';
import { pendingRewards } from '@/lib/rewards';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import type { RangeKey } from '@/lib/contracts';
import { ago, localizeTicket, num, pct } from '@/lib/format';
import { Badge, Card, PageHeader, btnClass } from '@/components/ui';
import {
  BarChart, KpiCard, LineChart, RangeTabs, WEEKDAYS, MONTHS_FULL, RANGE_LABEL,
  cap, dayLabel, delta, hourLabel, hourPhrase, hourTick, peakIndex, previousLabel, rangeDates
} from '@/components/dashboard';
import { SEVERITY_LABEL, SEVERITY_TONE } from '@/components/control/labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resumen · Stampa' };

/** Pasos para un negocio que aún no tiene movimiento en el rango. */
const FIRST_STEPS = [
  { href: '/panel/tarjeta/poster', title: 'Pon tu póster QR a la vista' },
  { href: '/panel/equipo', title: 'Invita a tu equipo' },
  { href: '/panel/caja', title: 'Da el primer sello' }
];

const h2 = 'font-display text-base font-semibold text-navy';
/** Filas de lista que se tocan con el dedo: 44 px de alto como mínimo. */
const rowLink = 'flex min-h-[44px] items-center gap-3 rounded-lg -mx-1 px-1 py-2 hover:bg-surface/70';

function greeting(timezone: string): string {
  let h = 12;
  try {
    h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date())) % 24;
  } catch { /* zona inválida: usa mediodía */ }
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default async function ResumenPage({ searchParams }: { searchParams: { rango?: string } }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { repo, business, program, template, staff } = ctx;
  const plan = features(business.plan);
  const asked: RangeKey = searchParams.rango === '7d' || searchParams.rango === '90d' ? searchParams.rango : '30d';
  const range: RangeKey = asked === '90d' && plan.statsDays < 90 ? '30d' : asked;
  const v = template.vocab;
  const [dash, redeemable, alerts] = await Promise.all([
    repo.getDashboard(business.id, range),
    repo.listRedeemable(business.id),
    plan.alerts ? repo.listAlerts(business.id, 3) : Promise.resolve([])
  ]);
  const now = Date.now();
  const k = dash.kpis, p = dash.previous;
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
    : 'Aún sin sellos para saber tu hora más fuerte.';
  const dayName = wdPeakIdx >= 0 ? WEEKDAYS[weekdays[wdPeakIdx].weekday] : '';
  const daySentence = wdPeakIdx >= 0
    ? `Tu día más fuerte es el ${dayName}, con ${num(weekdays[wdPeakIdx].stamps)} sellos.`
    : 'Aún sin sellos para saber tu día más fuerte.';

  const customersCap = cap(v.customers);
  const days = RANGE_LABEL[range];
  const dates = rangeDates(range, business.timezone);
  const stampsDelta = delta(k.stampsIssued, p.stampsIssued);
  /* Resumen de una línea: el rango siempre visible y cómo va el negocio en palabras. */
  const summary = !hasActivity
    ? `Últimos ${days} (${dates}): aún sin sellos.`
    : `Últimos ${days} (${dates}): ${num(k.stampsIssued)} sellos` +
      (stampsDelta && stampsDelta.dir !== 'new' ? `, ${stampsDelta.words.replace('el periodo anterior', previousLabel(range))}.` : '.');
  const rangeTag = <span className="font-normal text-muted"> · {days}</span>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(business.timezone)}, ${staff.name.split(' ')[0]}`}
        subtitle={summary}
        actions={<RangeTabs current={range} maxDays={plan.statsDays} />}
      />

      {asked !== range && (
        <p role="status" className="-mt-4 rounded-xl bg-[#FFF3CC] px-4 py-3 text-sm text-[#5C4400]">
          Tu plan muestra hasta {plan.statsDays} días. Te mostramos los últimos {days}.
        </p>
      )}

      <section aria-labelledby="kpi-h" className="flex flex-col gap-2">
        <h2 id="kpi-h" className="text-xs font-medium text-muted">
          Últimos {days} · las flechas comparan con {previousLabel(range)}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          <KpiCard primary label="Sellos entregados" value={num(k.stampsIssued)} delta={stampsDelta} />
          <KpiCard primary label={`${customersCap} que vinieron`} value={num(k.activeCustomers)} delta={delta(k.activeCustomers, p.activeCustomers)} />
          <KpiCard label={`${customersCap} nuevos`} value={num(k.newCustomers)} delta={delta(k.newCustomers, p.newCustomers)} />
          <KpiCard label={`${cap(v.reward)}s entregados`} value={num(k.rewardsRedeemed)} delta={delta(k.rewardsRedeemed, p.rewardsRedeemed)} />
          <KpiCard label={`${customersCap} que regresan`} value={pct(k.returnRate)} hint={`con 2 o más ${v.visits}`} />
          <KpiCard label={`Sellos por ${v.ticket.toLowerCase()}`} value={num(k.stampsPerTicket, 1)} hint="promedio" />
        </div>
      </section>

      {!hasActivity ? (
        <section aria-labelledby="sin-mov" className="rounded-2xl border border-dashed border-[#C9D6E3] bg-white/60 px-5 py-6 sm:px-6">
          <h2 id="sin-mov" className={h2}>Aún sin sellos en estos {days}</h2>
          <p className="mt-1 text-sm text-muted">Cuando des sellos, aquí verás tus horas y días más fuertes.</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {FIRST_STEPS.map((st, i) => (
              <li key={st.href}>
                <Link href={st.href} className="flex min-h-[48px] items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-navy ring-1 ring-line hover:bg-surface">
                  <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sun text-xs font-bold">{i + 1}</span>
                  {st.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <section aria-label="Tendencia" className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className={h2 + ' mb-3'}>Sellos por día{rangeTag}</h2>
              <LineChart id="ln-sellos" title="Sellos por día" unit="sellos"
                data={dash.series.map((s) => ({ label: dayLabel(s.date), value: s.stamps }))} />
            </Card>
            <Card>
              <h2 className={h2 + ' mb-3'}>{customersCap} nuevos por día{rangeTag}</h2>
              <LineChart id="ln-nuevos" title={`${customersCap} nuevos por día`} unit={v.customers}
                data={dash.series.map((s) => ({ label: dayLabel(s.date), value: s.newCustomers }))} />
            </Card>
          </section>

          <section aria-labelledby="cuando" className="grid gap-4 lg:grid-cols-2">
            <h2 id="cuando" className="sr-only">¿Cuándo viene tu gente?</h2>
            <Card>
              <h3 className={h2}>Por hora{rangeTag}</h3>
              <p className="mb-3 text-sm text-muted">{hourSentence}</p>
              <BarChart id="bar-hora" title="Sellos por hora del día" desc={hourSentence}
                items={hours.map((h) => ({ label: hourTick(h.hour), value: h.stamps, tooltip: `${hourLabel(h.hour)}: ${num(h.stamps)} sellos` }))}
                highlight={hPeak} labelEvery={hours.length > 12 ? 2 : 1} />
            </Card>
            <Card>
              <h3 className={h2}>Por día de la semana{rangeTag}</h3>
              <p className="mb-3 text-sm text-muted">{daySentence}</p>
              <BarChart id="bar-dia" title="Sellos por día de la semana" desc={daySentence}
                items={weekdays.map((w) => ({ label: WEEKDAYS[w.weekday].slice(0, 3), value: w.stamps, tooltip: `${cap(WEEKDAYS[w.weekday])}: ${num(w.stamps)} sellos` }))}
                highlight={wdPeakIdx} />
            </Card>
          </section>
        </>
      )}

      <section aria-label="Personas y premios" className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className={h2}>{cap(v.reward)}s por entregar</h2>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-navy">{num(redeemable.length)}</p>
          <p className="text-xs text-muted">
            {redeemable.length === 0 ? 'Nadie tiene la tarjeta completa todavía.' : `con la tarjeta completa`}
          </p>
          {redeemable.length > 0 && (
            <>
              <ul className="mt-2 divide-y divide-line/80 text-sm text-navy">
                {redeemable.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link href={`/panel/clientes/${c.id}`} className={rowLink + ' justify-between'}>
                      <span className="min-w-0 truncate font-medium">{c.name}</span>
                      <span className="min-w-0 truncate text-xs text-muted">{pendingRewards(c, program).map((r) => r.title).join(', ')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/panel/caja#premios" className={btnClass('primary', 'md') + ' mt-4 w-full sm:w-auto'}>Entregar en {v.counter.toLowerCase()}</Link>
            </>
          )}
        </Card>

        <Card>
          <h2 className={h2}>Mejores {v.customers}{rangeTag}</h2>
          {dash.topCustomers.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aquí verás a quienes más sellos juntan.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line/80">
              {dash.topCustomers.slice(0, 5).map((c, i) => (
                <li key={c.customerId}>
                  <Link href={`/panel/clientes/${c.customerId}`} className={rowLink}>
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
          <h2 className={h2}>Cumpleaños próximos</h2>
          {program.birthdayReward && <p className="mt-1 text-xs text-muted">Regalo: {program.birthdayReward}</p>}
          {dash.upcomingBirthdays.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Ninguno pronto.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line/80">
              {dash.upcomingBirthdays.slice(0, 5).map((b) => (
                <li key={b.customerId}>
                  <Link href={`/panel/clientes/${b.customerId}`} className={rowLink + ' justify-between'}>
                    <span className="min-w-0 truncate text-sm font-medium text-navy">{b.name}</span>
                    <span className="shrink-0 text-sm text-muted">{b.d} de {MONTHS_FULL[b.m]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {!plan.alerts ? (
        <PlanLock plan="standard" businessName={business.name} title="Alertas antifraude"
          text="Te avisamos si un código circula fuera del local, si alguien repite tickets o da más sellos de lo normal." />
      ) : (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-x-2">
          <h2 className={h2}>Alertas recientes</h2>
          <Link href="/panel/control#alertas" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy underline underline-offset-4">
            {alerts.length ? 'Ver qué hacer' : 'Ir a control'}
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone="ok"><span aria-hidden="true">✓&nbsp;</span>Todo en orden</Badge> Nada raro en {v.counter.toLowerCase()}.
          </p>
        ) : (
          <ul className="divide-y divide-line/80">
            {alerts.slice(0, 3).map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <span className="w-[4.5rem] shrink-0"><Badge tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Badge></span>
                <span className="min-w-0 flex-1 basis-60 text-sm text-navy">{localizeTicket(a.message, v.ticket)}</span>
                <span className="text-xs text-muted">{ago(a.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      )}
    </div>
  );
}
