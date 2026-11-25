import type { ReactNode } from 'react';
import type { BusinessHealth } from '@/lib/contracts';
import { HEALTH_LABEL } from '@/lib/domain/admin-insights';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';

/** Piezas pequeñas del Resumen del administrador (componentes de servidor). */

export const h2Class = 'font-display text-lg font-semibold text-navy';
export const focusRing = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60';

export function SectionHeader({ id, title, text, actions }: { id: string; title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 id={id} className={h2Class}>{title}</h2>
        {text && <p className="mt-0.5 text-sm text-muted">{text}</p>}
      </div>
      {actions}
    </div>
  );
}

/* ---------- Semáforo: color + forma + texto (no depende solo del color) ---------- */

const DOT: Record<BusinessHealth, string> = {
  green: 'bg-good',
  yellow: 'bg-[#E0A800]',
  red: 'bg-bad',
  none: 'bg-[#9FB1C5]'
};
const SHAPE: Record<BusinessHealth, string> = { green: 'rounded-full', yellow: 'rounded-[2px] rotate-45', red: 'rounded-[1px]', none: 'rounded-full' };
export const HEALTH_TEXT_CLASS: Record<BusinessHealth, string> = {
  green: 'text-[#12683F]', yellow: 'text-[#7A5A00]', red: 'text-[#9B2A22]', none: 'text-muted'
};

export function HealthDot({ health, className }: { health: BusinessHealth; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 shrink-0', DOT[health], SHAPE[health], className)} />;
}

/** Punto + etiqueta ("Activo", "Bajando", "Sin uso"). */
export function HealthTag({ health }: { health: BusinessHealth }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold', HEALTH_TEXT_CLASS[health])}>
      <HealthDot health={health} />
      {HEALTH_LABEL[health]}
    </span>
  );
}

/* ---------- Contacto ---------- */

function WhatsappIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
    </svg>
  );
}

/** Botón para escribir al dueño. `who` va en el nombre accesible ("Escribir por WhatsApp a Café Lucía"). */
/** `compact`: en teléfonos solo muestra el ícono (el nombre accesible no cambia). */
export function ContactButton({ href, channel, who, compact }: { href: string; channel: 'whatsapp' | 'email'; who: string; compact?: boolean }) {
  const wa = channel === 'whatsapp';
  return (
    <a href={href} target={wa ? '_blank' : undefined} rel={wa ? 'noopener noreferrer' : undefined}
      aria-label={`${wa ? 'Escribir por WhatsApp' : 'Escribir un correo'} a ${who}${wa ? ' (se abre en otra pestaña)' : ''}`}
      className={cn(btnClass('ghost', 'sm'), 'shrink-0', compact && 'w-11 px-0 sm:w-auto sm:px-4', focusRing)}>
      {wa ? <WhatsappIcon /> : <MailIcon />}
      <span className={compact ? 'hidden sm:inline' : undefined}>{wa ? 'WhatsApp' : 'Correo'}</span>
    </a>
  );
}

/* ---------- Barras horizontales (reparto por plan) ---------- */

export function HBar({ value, max, tone = 'navy' }: { value: number; max: number; tone?: 'navy' | 'sun' }) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-line" role="presentation">
      <div className={cn('h-full rounded-full', tone === 'navy' ? 'bg-navy' : 'bg-sun')} style={{ width: `${w}%` }} />
    </div>
  );
}

/* ---------- Barras verticales con formato libre (dinero) ---------- */

const W = 480, H = 196, ML = 8, MR = 8, MT = 26, MB = 30;

/**
 * Barras verticales en SVG para valores con formato propio (por ejemplo dólares).
 * Cada barra lleva su valor encima; el último periodo (el actual) va en amarillo.
 */
export function ValueBars({ id, title, desc, items, format }: {
  id: string; title: string; desc: string; items: { label: string; value: number }[]; format: (v: number) => string;
}) {
  const n = items.length;
  const max = Math.max(1, ...items.map((i) => i.value));
  const iw = W - ML - MR, ih = H - MT - MB;
  const slot = n ? iw / n : iw;
  const bw = Math.min(46, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      <line x1={ML} x2={W - MR} y1={MT + ih} y2={MT + ih} stroke="#9FB1C5" strokeWidth={1} />
      {items.map((it, i) => {
        const h = (it.value / max) * ih;
        const cx = ML + slot * i + slot / 2;
        const last = i === n - 1;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={MT + ih - h} width={bw} height={Math.max(h, it.value > 0 ? 2 : 0)} rx={3}
              fill={last ? '#FFC301' : '#C3D0DF'} stroke={last ? '#001D3D' : 'none'} strokeWidth={last ? 1.75 : 0}>
              <title>{`${it.label}: ${format(it.value)}`}</title>
            </rect>
            <text x={cx} y={MT + ih - h - 7} textAnchor="middle" fontSize={13} fontWeight={last ? 700 : 500} fill="#001D3D">{format(it.value)}</text>
            <text x={cx} y={H - 9} textAnchor="middle" fontSize={14} fontWeight={last ? 700 : 400} fill={last ? '#001D3D' : '#4A6380'}>{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export const countText = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;
