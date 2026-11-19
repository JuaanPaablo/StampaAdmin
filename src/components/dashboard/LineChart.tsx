import { num } from '@/lib/format';

export interface LinePoint { label: string; value: number }

/** Marcas "bonitas" para el eje Y: devuelve el máximo redondeado y el paso. */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { top: step * 4, step };
}

const W = 480, H = 230, ML = 38, MR = 18, MT = 14, MB = 32;

/**
 * Gráfico de línea con área, en SVG puro y renderizado en servidor.
 * Accesible: role="img" con title y desc, y un resumen en texto debajo.
 */
export function LineChart({ id, title, unit, data, caption }: {
  id: string; title: string; unit: string; data: LinePoint[]; caption?: string;
}) {
  const n = data.length;
  const values = data.map((d) => d.value);
  const max = Math.max(0, ...values);
  const { top, step } = niceScale(max);
  const iw = W - ML - MR, ih = H - MT - MB;
  const x = (i: number) => ML + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => MT + ih - (v / top) * ih;

  const total = values.reduce((a, b) => a + b, 0);
  const avg = n ? total / n : 0;
  let peak = -1; let peakVal = 0;
  values.forEach((v, i) => { if (v > peakVal) { peakVal = v; peak = i; } });

  const line = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.value).toFixed(1)).join(' ');
  const area = n ? line + ` L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : '';
  const yTicks = [0, 1, 2, 3, 4].map((k) => k * step);
  const xIdx = Array.from(new Set(n <= 5 ? data.map((_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4))));

  const summary = n === 0 || total === 0
    ? `${title}: sin ${unit} en este periodo.`
    : `${title}: ${num(total)} ${unit} en ${n} días, ${num(avg, 1)} por día en promedio. El día más alto fue el ${data[peak].label}, con ${num(peakVal)}.`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{summary}</desc>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9FB1C5' : '#E1E8F0'} strokeWidth={1} />
            <text x={ML - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill="#4A6380">{num(t, step < 1 ? 1 : 0)}</text>
          </g>
        ))}
        {xIdx.map((i, k) => (
          <text key={i} x={x(i)} y={H - 10} fontSize={12} fill="#4A6380"
            textAnchor={k === 0 && n > 1 ? 'start' : k === xIdx.length - 1 && n > 1 ? 'end' : 'middle'}>{data[i].label}</text>
        ))}
        {n > 0 && <path d={area} fill="#001D3D" opacity={0.08} />}
        {n > 0 && <path d={line} fill="none" stroke="#001D3D" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />}
        {n > 0 && n <= 31 && data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={i === peak ? 5 : 2.5} fill={i === peak ? '#FFC301' : '#001D3D'} stroke="#001D3D" strokeWidth={i === peak ? 2 : 0}>
            <title>{`${d.label}: ${num(d.value)} ${unit}`}</title>
          </circle>
        ))}
        {n > 31 && peak >= 0 && (
          <circle cx={x(peak)} cy={y(peakVal)} r={5} fill="#FFC301" stroke="#001D3D" strokeWidth={2}>
            <title>{`${data[peak].label}: ${num(peakVal)} ${unit}`}</title>
          </circle>
        )}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">{caption ?? summary}</figcaption>
    </figure>
  );
}
