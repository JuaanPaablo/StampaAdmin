'use client';

import { useState, useTransition } from 'react';
import { savePosterAction } from '@/app/panel/tarjeta/actions';
import { btnClass, Card, Input } from '@/components/ui';
import type { PosterStyle } from '@/lib/contracts';
import { contrastRatio, normalizeHex } from './contrast';
import { ContrastHint } from './ContrastHint';
import { useUnsavedGuard } from './useUnsavedGuard';
import { DEFAULT_POSTER_TITLE, POSTER_FONTS, POSTER_THEMES, PosterSheet, posterPalette, type PosterProps } from './PosterSheet';

const label = 'text-xs font-semibold tracking-wide text-muted';

/** Editor del póster: tema de color, letra, título y premio. A la derecha (o debajo en el teléfono) se ve en vivo. */
export function PosterDesigner({ initial, sheet }: { initial?: PosterStyle; sheet: Omit<PosterProps, 'design'> }) {
  const [d, setD] = useState<PosterStyle>({ theme: 'stampa', font: 'sora', title: '', showReward: true, ...initial });
  const [saved, setSaved] = useState<string>(JSON.stringify(d));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<PosterStyle>) => { setMsg(null); setD((x) => ({ ...x, ...patch })); };
  const pal = posterPalette(d, sheet.colors);
  const custom = d.theme === 'personal';
  const lowContrast = contrastRatio(pal.ink, pal.bg) < 4.5;
  const dirty = JSON.stringify(d) !== saved;
  useUnsavedGuard(dirty);

  function save() {
    const payload = { ...d, ...(custom ? { bg: pal.bg, accent: pal.accent, ink: pal.ink } : {}) };
    start(async () => {
      try {
        const r = await savePosterAction(payload);
        if (r.ok) { setSaved(JSON.stringify(d)); setMsg({ ok: true, text: 'Diseño guardado. Ya puedes imprimir.' }); }
        else setMsg({ ok: false, text: r.error ?? 'No pudimos guardar. Intenta de nuevo.' });
      } catch {
        setMsg({ ok: false, text: 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.' });
      }
    });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card data-noprint className="space-y-5 xl:sticky xl:top-6">
        <fieldset>
          <legend className={label}>Colores</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {POSTER_THEMES.map((t) => {
              const p = posterPalette({ ...d, theme: t.id }, sheet.colors);
              const on = (d.theme ?? 'stampa') === t.id;
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => set({ theme: t.id, ...(t.id === 'personal' && !d.bg ? { bg: pal.bg, accent: pal.accent, ink: pal.ink } : {}) })}
                  className={'flex min-h-[44px] items-center gap-2 rounded-xl p-2 text-left text-xs font-semibold text-navy ring-1 ring-inset transition ' + (on ? 'bg-surface ring-2 ring-navy' : 'bg-white ring-[#C9D6E3] hover:bg-surface')}>
                  <span className="flex shrink-0 overflow-hidden rounded-full ring-1 ring-black/10" aria-hidden="true">
                    {[p.bg, p.accent, p.ink].map((c, i) => <span key={i} className="h-6 w-4" style={{ background: c }} />)}
                  </span>
                  <span className="leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {custom && (
          <div className="grid grid-cols-3 gap-3">
            {(['bg', 'accent', 'ink'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1.5">
                <span className={label}>{k === 'bg' ? 'Fondo' : k === 'accent' ? 'Detalles' : 'Texto'}</span>
                <input type="color" value={normalizeHex(d[k] ?? '') ?? pal[k]} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })}
                  className="h-11 w-full cursor-pointer rounded-xl border-[1.5px] border-[#C9D6E3] bg-white p-1" />
              </label>
            ))}
          </div>
        )}
        {(custom || lowContrast) && (
          <div className="rounded-xl bg-surface p-3">
            <ContrastHint label="Texto sobre el fondo" ratio={contrastRatio(pal.ink, pal.bg)} min={4.5} />
          </div>
        )}

        <fieldset>
          <legend className={label}>Tipo de letra</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {POSTER_FONTS.map((f) => {
              const on = (d.font ?? 'sora') === f.id;
              return (
                <button key={f.id} type="button" aria-pressed={on} onClick={() => set({ font: f.id })}
                  className={'h-12 rounded-xl px-3 text-left text-[15px] text-navy ring-1 ring-inset transition ' + (on ? 'bg-surface ring-2 ring-navy' : 'bg-white ring-[#C9D6E3] hover:bg-surface')}
                  style={{ fontFamily: `'${f.family}', Sora, sans-serif`, fontWeight: f.id === 'impacto' || f.id === 'manuscrita' ? 400 : 700 }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Título</span>
          <Input value={d.title ?? ''} maxLength={40} placeholder={DEFAULT_POSTER_TITLE} onChange={(e) => set({ title: e.target.value })}
            aria-describedby="poster-title-help" className="placeholder:text-[#6B819A]" />
          <span id="poster-title-help" className="text-xs text-muted">Vacío: “{DEFAULT_POSTER_TITLE}”. {(d.title ?? '').length}/40</span>
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-navy">
          <input type="checkbox" checked={d.showReward !== false} onChange={(e) => set({ showReward: e.target.checked })} className="h-5 w-5 accent-[#001D3D]" />
          Mostrar el premio
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button type="button" onClick={save} disabled={pending || !dirty} aria-busy={pending} className={btnClass('primary')}>{pending ? 'Guardando…' : 'Guardar diseño'}</button>
          {dirty && <button type="button" onClick={() => { setD(JSON.parse(saved)); setMsg(null); }} disabled={pending} className={btnClass('ghost')}>Deshacer</button>}
          {dirty && !msg && <p className="w-full text-xs font-semibold text-navy">Cambios sin guardar. Lo que imprimas sale tal como lo ves.</p>}
          <p role="status" aria-live="polite" className={'w-full text-sm font-medium ' + (msg?.ok ? 'text-[#12683F]' : 'text-bad')}>{msg?.text ?? ''}</p>
        </div>
      </Card>

      <PosterSheet {...sheet} design={d} />
    </div>
  );
}
