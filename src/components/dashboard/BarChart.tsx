import { num } from '@/lib/format';

export interface BarItem { label: string; value: number; tooltip?: string }

const W = 480, H = 190, ML = 8, MR = 8, MT = 22, MB = 28;

/** Barras verticales en SVG. La barra más alta va en amarillo con borde navy y lleva su valor encima. */
export function BarChart({ id, title, desc, items, highlight, labelEvery = 1 }: {
  id: string; title: string; desc: string; items: BarItem[]; highlight: number; labelEvery?: number;
}) {
  const n = items.length;
  const max = Math.max(1, ...items.map((i) => i.value));
  const iw = W - ML - MR, ih = H - MT - MB;
  const slot = n ? iw / n : iw;
  const bw = Math.min(34, slot * 0.68);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      <line x1={ML} x2={W - MR} y1={MT + ih} y2={MT + ih} stroke="#9FB1C5" strokeWidth={1} />
      {items.map((it, i) => {
        const h = (it.value / max) * ih;
        const cx = ML + slot * i + slot / 2;
        const isPeak = i === highlight;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={MT + ih - h} width={bw} height={Math.max(h, it.value > 0 ? 2 : 0)} rx={3}
              fill={isPeak ? '#FFC301' : '#C3D0DF'} stroke={isPeak ? '#001D3D' : 'none'} strokeWidth={isPeak ? 1.75 : 0}>
              <title>{it.tooltip ?? `${it.label}: ${num(it.value)}`}</title>
            </rect>
            {isPeak && it.value > 0 && (
              <text x={cx} y={MT + ih - h - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="#001D3D">{num(it.value)}</text>
            )}
            {(i % labelEvery === 0 || isPeak) && (
              <text x={cx} y={H - 9} textAnchor="middle" fontSize={12} fontWeight={isPeak ? 700 : 400} fill={isPeak ? '#001D3D' : '#4A6380'}>{it.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
