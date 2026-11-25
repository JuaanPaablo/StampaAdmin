import Link from 'next/link';
import { LineChart } from '@/components/dashboard';
import type { SeriesPoint } from '@/lib/contracts';
import { num } from '@/lib/format';
import { cn } from '@/lib/cn';

export type DetailRange = 30 | 90;

export function parseDetailRange(raw: unknown): DetailRange {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === '90' || v === '90d' ? 90 : 30;
}

/** Selector 30 / 90 días por enlaces (funciona sin JavaScript). */
function RangeToggle({ basePath, current }: { basePath: string; current: DetailRange }) {
  return (
    <nav aria-label="Periodo del gráfico" className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-[#C9D6E3]">
      {([30, 90] as const).map((r) => (
        <Link key={r} href={`${basePath}${r === 30 ? '' : '?rango=90'}#actividad`} scroll={false} aria-current={r === current ? 'page' : undefined}
          className={cn('inline-flex min-h-[44px] items-center rounded-full px-4 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy',
            r === current ? 'bg-navy text-white' : 'text-navy hover:bg-surface')}>
          {r} días
        </Link>
      ))}
    </nav>
  );
}

/** Sellos y canjes por día del negocio (últimos 30 o 90 días). */
export function ActivityChart({ basePath, range, stamps, redemptions }: {
  basePath: string; range: DetailRange; stamps: SeriesPoint[]; redemptions: SeriesPoint[];
}) {
  const s = stamps.slice(-range);
  const r = redemptions.slice(-range);
  const totalS = s.reduce((a, p) => a + p.value, 0);
  const totalR = r.reduce((a, p) => a + p.value, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <strong className="font-semibold text-navy">{num(totalS)}</strong> sellos y <strong className="font-semibold text-navy">{num(totalR)}</strong> canjes en {range} días
        </p>
        <RangeToggle basePath={basePath} current={range} />
      </div>
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-navy">Sellos por día</h3>
          <LineChart id={`sellos-${range}`} title={`Sellos por día, últimos ${range} días`} unit="sellos" data={s.map((p) => ({ label: p.label, value: p.value }))} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-navy">Canjes por día</h3>
          <LineChart id={`canjes-${range}`} title={`Canjes por día, últimos ${range} días`} unit="canjes" data={r.map((p) => ({ label: p.label, value: p.value }))} />
        </div>
      </div>
    </div>
  );
}
