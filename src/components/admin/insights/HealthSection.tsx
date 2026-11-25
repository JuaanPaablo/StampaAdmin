import Link from 'next/link';
import type { AdminInsights, BusinessActivity, BusinessHealth } from '@/lib/contracts';
import { HEALTH_GREEN_DAYS, HEALTH_LABEL, HEALTH_YELLOW_DAYS } from '@/lib/domain/admin-insights';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { HEALTH_TEXT_CLASS, HealthDot, HealthTag, SectionHeader, focusRing } from './bits';
import { HEALTH_QUERY, lastStampLabel } from './helpers';

const CHIPS: { health: Exclude<BusinessHealth, 'none'>; hint: string; ring: string }[] = [
  { health: 'green', hint: `Sellos en los últimos ${HEALTH_GREEN_DAYS} días`, ring: 'ring-[#B5E3CB] bg-[#F1FAF5]' },
  { health: 'yellow', hint: `Último sello hace ${HEALTH_GREEN_DAYS} a ${HEALTH_YELLOW_DAYS} días`, ring: 'ring-[#F2DC8F] bg-[#FFFBEB]' },
  { health: 'red', hint: `Más de ${HEALTH_YELLOW_DAYS} días sin sellos`, ring: 'ring-[#EFC3BF] bg-[#FDF3F2]' }
];

function RankList({ id, title, text, items }: { id: string; title: string; text: string; items: BusinessActivity[] }) {
  return (
    <Card className="min-w-0 !p-0">
      <div className="px-4 pt-4 sm:px-5">
        <h3 id={id} className="font-display text-base font-semibold text-navy">{title}</h3>
        <p className="text-xs text-muted">{text}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 pb-4 pt-3 text-sm text-muted sm:px-5">Aún no hay negocios activos.</p>
      ) : (
        <>
          <div aria-hidden="true" className="mt-3 grid grid-cols-[1fr_auto_auto] gap-3 border-b border-line px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
            <span>Negocio</span><span className="w-12 text-right">Sellos</span><span className="w-[4.5rem] text-right">Último</span>
          </div>
          <ol aria-labelledby={id} className="divide-y divide-line">
            {items.map((b) => (
              <li key={b.businessId}>
                <Link href={`/admin/negocios/${b.businessId}`}
                  className={cn('grid min-h-[52px] grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 hover:bg-surface sm:px-5', focusRing)}>
                  <span className="min-w-0">
                    <span className="block line-clamp-2 break-words text-sm font-semibold text-navy">{b.businessName}</span>
                    <HealthTag health={b.health} />
                  </span>
                  <span className="w-12 text-right font-display text-sm font-semibold tabular-nums text-navy">
                    {num(b.stamps30d)}<span className="sr-only"> sellos en 30 días</span>
                  </span>
                  <span className="w-[4.5rem] text-right text-xs text-muted">
                    <span className="sr-only">Último sello: </span>{lastStampLabel(b.daysSinceLastStamp)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

/** Semáforo de actividad y los negocios que más y menos sellan. */
export function HealthSection({ health, ranking }: { health: AdminInsights['health']; ranking: AdminInsights['ranking'] }) {
  const none = health.counts.none;
  return (
    <section aria-labelledby="salud">
      <SectionHeader id="salud" title="Salud de los negocios"
        text={`Según el último sello.${none ? ` ${num(none)} no ${none === 1 ? 'aplica' : 'aplican'} (configurando o suspendidos).` : ''}`} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {CHIPS.map((c) => {
          const n = health.counts[c.health];
          return (
            <li key={c.health}>
              <Link href={`/admin/negocios?salud=${HEALTH_QUERY[c.health]}`}
                className={cn('flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition hover:brightness-[.98]', c.ring, focusRing)}>
                <HealthDot health={c.health} className="h-3.5 w-3.5" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-semibold', HEALTH_TEXT_CLASS[c.health])}>{HEALTH_LABEL[c.health]}</span>
                  <span className="block text-xs text-muted">{c.hint}</span>
                </span>
                <span className="font-display text-2xl font-bold tabular-nums text-navy">{num(n)}</span>
                <span className="sr-only">{n === 1 ? 'negocio' : 'negocios'}. Ver la lista.</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
        <RankList id="top5" title="Los que más sellan" text="Negocios activos, sellos de los últimos 30 días." items={ranking.top} />
        <RankList id="empujon" title="Necesitan un empujón" text="Los que menos sellan. Escríbeles para ayudarles." items={ranking.bottom} />
      </div>
    </section>
  );
}
