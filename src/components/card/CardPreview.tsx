'use client';

import { useId, useState } from 'react';
import { alpha, contrastRatio, normalizeHex, readableOn } from './contrast';
import { Isotype, StampGrid } from './StampGrid';
import { safeImageUrl } from './images';
import { framingStyle, lcfirst } from '@/lib/rewards';
import type { ImageFraming, Milestone } from '@/lib/contracts';

export interface PreviewData {
  businessName: string;
  programName: string;
  stampsRequired: number;
  rewardTitle: string;
  bg: string; accent: string; ink: string;
  logoText: string;
  logoUrl?: string;
  /** Foto de portada (opcional). */
  coverUrl?: string;
  milestones?: Milestone[];
  logoFraming?: Partial<ImageFraming>;
  coverFraming?: Partial<ImageFraming>;
}

type Mode = 'tarjeta' | 'apple' | 'google';
const MODES: { id: Mode; label: string }[] = [
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'apple', label: 'Apple Wallet' },
  { id: 'google', label: 'Google Wallet' }
];


export function remainingMessage(remaining: number, reward: string): string {
  const r = lcfirst(reward.trim() || 'premio');
  if (remaining <= 0) return `Tu ${r} está listo para canjear`;
  return remaining === 1 ? `Te falta 1 sello para tu ${r}` : `Te faltan ${remaining} sellos para tu ${r}`;
}

function Logo({ text, url, accent, size, framing }: { text: string; url?: string; accent: string; size: number; framing?: Partial<ImageFraming> }) {
  const [failed, setFailed] = useState<string | null>(null);
  const safe = safeImageUrl(url);
  const showImg = !!safe && failed !== safe;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-bold"
      style={{ width: size, height: size, background: accent, color: readableOn(accent), fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {showImg
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={safe} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={framingStyle(framing)} onError={() => setFailed(safe ?? null)} />
        : (text || '?').slice(0, 3).toUpperCase()}
    </span>
  );
}

function Progress({ value, total, accent, ink }: { value: number; total: number; accent: string; ink: string }) {
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label="Progreso de la tarjeta"
      className="h-2 w-full overflow-hidden rounded-full" style={{ background: alpha(ink, 0.18) }}>
      <div className="h-full rounded-full transition-all" style={{ width: (total ? (value / total) * 100 : 0) + '%', background: accent }} />
    </div>
  );
}

/** Código de barras ilustrativo (no es un QR real). */
function FakeCode({ dark = '#001D3D', size = 72 }: { dark?: string; size?: number }) {
  const cells = [
    '1110110111', '1010010101', '1011101101', '0001011000', '1101110111',
    '0110001010', '1011010111', '1000101001', '1110111011', '1010100101'
  ];
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges" fill={dark}>
      {cells.flatMap((row, y) => row.split('').map((c, x) => (c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}

export function CardPreview({ data }: { data: PreviewData }) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>('tarjeta');
  const [simulated, setSimulated] = useState(3);
  const total = Math.max(1, data.stampsRequired);
  const filled = Math.min(simulated, total);
  const bg = normalizeHex(data.bg) ?? '#001D3D';
  const accent = normalizeHex(data.accent) ?? '#FFC301';
  const ink = normalizeHex(data.ink) ?? '#FFFFFF';
  const remaining = total - filled;
  const cover = safeImageUrl(data.coverUrl);
  const marks = (data.milestones ?? []).filter((m) => m.at >= 1 && m.at < total && m.title.trim()).sort((a, b) => a.at - b.at);
  const nextGift = marks.find((m) => m.at > filled);
  const justWon = marks.find((m) => m.at === filled);
  const message = justWon ? `¡Ganaste: ${justWon.title}!` : nextGift ? remainingMessage(nextGift.at - filled, nextGift.title) : remainingMessage(remaining, data.rewardTitle);
  const gridMarks = marks.map((m) => m.at);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = MODES[(i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length].id;
    setMode(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line/70">
      <h2 className="font-display text-base font-semibold text-navy">Vista previa en vivo</h2>
      <div role="tablist" aria-label="Tipo de vista" className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-surface p-1">
        {MODES.map((m, i) => (
          <button
            key={m.id} id={`${uid}-tab-${m.id}`} role="tab" type="button" aria-selected={mode === m.id} aria-controls={`${uid}-panel`}
            tabIndex={mode === m.id ? 0 : -1} onClick={() => setMode(m.id)} onKeyDown={(e) => onKey(e, i)}
            className={'h-9 rounded-full px-2 text-xs font-semibold transition ' + (mode === m.id ? 'bg-navy text-white' : 'text-navy hover:bg-white')}
          >{m.label}</button>
        ))}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="mt-4">
        {mode === 'tarjeta' && (
          <div className="overflow-hidden rounded-3xl shadow-card" style={{ background: bg, color: ink }}>
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <div className="aspect-[3/1] w-full overflow-hidden"><img src={cover} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={framingStyle(data.coverFraming)} /></div>
            )}
            <div className="p-5">
            <div className="flex items-center gap-3">
              <Logo text={data.logoText} url={data.logoUrl} accent={accent} size={44} framing={data.logoFraming} />
              <div className="min-w-0">
                <p className="truncate text-xs" style={{ color: alpha(ink, 0.75) }}>{data.businessName}</p>
                <p className="truncate font-display text-base font-bold">{data.programName || 'Tu tarjeta'}</p>
              </div>
            </div>
            <div className="mt-5"><StampGrid total={total} filled={filled} bg={bg} accent={accent} ink={ink} milestones={gridMarks} /></div>
            <div className="mt-5">
              <Progress value={filled} total={total} accent={accent} ink={ink} />
              <p className="mt-2 text-sm font-semibold" >{message}</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px]" style={{ borderColor: alpha(ink, 0.2), color: alpha(ink, 0.75) }}>
              <span>{filled} de {total} sellos</span>
              <span className="inline-flex items-center gap-1.5"><Isotype color={accent} className="h-4 w-4" /> con Stampa</span>
            </div>
            </div>
          </div>
        )}

        {mode === 'apple' && (
          <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl shadow-card ring-1 ring-black/10" style={{ background: bg, color: ink }}>
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <div className="flex min-w-0 items-center gap-2">
                <Logo text={data.logoText} url={data.logoUrl} accent={accent} size={28} framing={data.logoFraming} />
                <span className="truncate text-sm font-semibold">{data.businessName}</span>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: alpha(ink, 0.7) }}>Sellos</p>
                <p className="text-lg font-bold leading-none tabular-nums">{filled}/{total}</p>
              </div>
            </div>
            <div className="mt-3 px-4 py-3" style={{ background: alpha(ink, 0.07) }}>
              <StampGrid total={total} filled={filled} bg={bg} accent={accent} ink={ink} />
            </div>
            <div className="flex justify-between gap-3 px-4 pt-3 text-xs">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: alpha(ink, 0.7) }}>Premio</p>
                <p className="truncate font-semibold">{data.rewardTitle || 'Premio'}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: alpha(ink, 0.7) }}>Faltan</p>
                <p className="font-semibold tabular-nums">{remaining}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-center pb-4">
              <span className="rounded-lg bg-white p-2"><FakeCode size={76} /></span>
            </div>
          </div>
        )}

        {mode === 'google' && (
          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/10">
            <div className="px-4 pb-4 pt-4" style={{ background: bg, color: ink }}>
              <div className="flex items-center gap-2">
                <Logo text={data.logoText} url={data.logoUrl} accent={accent} size={28} framing={data.logoFraming} />
                <span className="truncate text-sm font-semibold">{data.businessName}</span>
              </div>
              <p className="mt-4 font-display text-xl font-bold leading-tight">{data.programName || 'Tu tarjeta'}</p>
              <p className="mt-1 text-xs" style={{ color: alpha(ink, 0.8) }}>{message}</p>
            </div>
            <div className="px-4 py-3">
              <StampGridLight total={total} filled={filled} bg={bg} accent={accent} />
            </div>
            <div className="flex items-end justify-between gap-3 px-4 pb-4 text-xs text-navy">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Sellos</p>
                <p className="text-base font-bold tabular-nums">{filled} de {total}</p>
              </div>
              <FakeCode size={64} />
            </div>
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-muted">
          {mode === 'tarjeta' ? 'Así se verá tu tarjeta en el teléfono.' : 'Maqueta ilustrativa: cada billetera ajusta el diseño final del pase.'}
        </p>
      </div>

      <div className="mt-4 rounded-xl bg-surface p-3">
        <div className="flex items-center justify-between">
          <label htmlFor={`${uid}-sim`} className="text-xs font-semibold text-muted">Simular sellos</label>
          <output htmlFor={`${uid}-sim`} className="text-sm font-bold tabular-nums text-navy">{filled} de {total}</output>
        </div>
        <input id={`${uid}-sim`} type="range" min={0} max={total} step={1} value={filled}
          onChange={(e) => setSimulated(Number(e.target.value))} className="mt-2 w-full accent-[#001D3D]" />
      </div>
    </div>
  );
}

/** Rejilla compacta sobre fondo blanco para la maqueta de Google Wallet. */
function StampGridLight({ total, filled, bg, accent }: { total: number; filled: number; bg: string; accent: string }) {
  // Sobre blanco se usa el color (acento o fondo) que más contraste tenga.
  const fill = contrastRatio(accent, '#FFFFFF') >= contrastRatio(bg, '#FFFFFF') ? accent : bg;
  return <StampGrid total={total} filled={filled} bg="#FFFFFF" accent={fill} ink="#001D3D" />;
}
