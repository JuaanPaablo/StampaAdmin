'use client';

import { useRef, useState, useTransition } from 'react';
import { enhancePhotoAction, uploadMarketingPhotoAction } from '@/app/panel/marketing/actions';
import { btnClass, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { MarketingPhoto } from '@/lib/contracts';
import { PHOTO_STYLES, SEASON_LABEL, type PhotoAdvice, type PhotoStyle, type Season } from '@/lib/marketing/photos';
import type { Quota } from '@/lib/marketing/service';

/** Foto elegida para los posts: una foto subida (id) o la portada de la tarjeta. */
export type PhotoChoice = { kind: 'photo'; id: string; url: string } | { kind: 'portada'; url: string } | null;

const MAX_SIDE = 1600;

/**
 * Reduce la foto en el navegador antes de subirla (máx. 1600 px, JPG 86 %): sube más rápido con datos móviles y
 * respeta la orientación de las fotos del celular.
 */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No pudimos leer la foto.'))), 'image/jpeg', 0.86));
}

export function PhotoPanel({ photos: initial, coverUrl, quota: initialQuota, advice, value, onChange, onEnhanced, aiReady }: {
  photos: MarketingPhoto[];
  coverUrl?: string;
  quota: Quota;
  advice: PhotoAdvice[];
  value: PhotoChoice;
  onChange: (p: PhotoChoice) => void;
  onEnhanced?: () => void;
  aiReady: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  const [quota, setQuota] = useState(initialQuota);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'subiendo' | PhotoStyle | null>(null);
  const [pending, start] = useTransition();
  const [before, setBefore] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const recommended = new Map(advice.map((a) => [a.style, a]));
  const season: Season | undefined = advice.find((a) => a.style === 'temporada')?.season;

  function upload(file: File) {
    setError(null); setBusy('subiendo'); setBefore(null);
    start(async () => {
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set('foto', new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
        const r = await uploadMarketingPhotoAction(fd);
        if (!r.ok) { setError(r.error); return; }
        setPhotos((p) => [r.photo, ...p]);
        onChange({ kind: 'photo', id: r.photo.id, url: r.photo.url });
      } catch {
        setError('No pudimos leer esa foto. Prueba con otra en JPG o PNG.');
      } finally {
        setBusy(null);
        if (input.current) input.current.value = '';
      }
    });
  }

  function enhance(style: PhotoStyle) {
    if (value?.kind !== 'photo') return;
    setError(null); setBusy(style);
    const original = value.url;
    start(async () => {
      const r = await enhancePhotoAction({ photoId: value.id, style, season: style === 'temporada' ? season ?? 'navidad' : undefined });
      setBusy(null);
      if (r.quota) setQuota(r.quota);
      if (!r.ok) { setError(r.error); return; }
      setPhotos((p) => [r.photo, ...p]);
      setBefore(original);
      onChange({ kind: 'photo', id: r.photo.id, url: r.photo.url });
      onEnhanced?.();
    });
  }

  const selectedUrl = value?.url;
  const noQuota = quota.left <= 0;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Tu foto</h2>
          <p className="text-sm text-muted">Real, de tu producto o local. La IA la mejora, no la inventa.</p>
        </div>
        <p className="text-xs text-muted" title="Mejoras con IA este mes. Se renuevan el día 1.">Fotos IA <strong className="text-navy">{quota.used}/{quota.limit}</strong></p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" id="foto-mkt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <label htmlFor="foto-mkt" className={cn(btnClass('primary'), 'cursor-pointer', pending && 'pointer-events-none opacity-60')}>
          {busy === 'subiendo' ? 'Subiendo…' : 'Subir foto'}
        </label>
        {coverUrl && (
          <button type="button" onClick={() => { setBefore(null); onChange(value?.kind === 'portada' ? null : { kind: 'portada', url: coverUrl }); }}
            aria-pressed={value?.kind === 'portada'} className={btnClass(value?.kind === 'portada' ? 'dark' : 'ghost', 'sm')}>Usar mi portada</button>
        )}
        {value && <button type="button" onClick={() => { setBefore(null); onChange(null); }} className={btnClass('ghost', 'sm')}>Sin foto</button>}
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Tus fotos">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => { setBefore(null); onChange({ kind: 'photo', id: p.id, url: p.url }); }}
              aria-pressed={value?.kind === 'photo' && value.id === p.id}
              className={cn('size-20 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2', value?.kind === 'photo' && value.id === p.id ? 'ring-navy' : 'ring-transparent')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Foto subida" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {selectedUrl && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {before && (
              <div className="grid grid-cols-2 gap-2 text-center text-xs text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <figure className="flex flex-col gap-1"><img src={before} alt="Antes" className="aspect-square w-full rounded-xl object-cover" /><figcaption>Antes</figcaption></figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <figure className="flex flex-col gap-1"><img src={selectedUrl} alt="Después" className="aspect-square w-full rounded-xl object-cover" /><figcaption>Después</figcaption></figure>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {!before && <img src={selectedUrl} alt="Foto elegida" className="aspect-square w-full rounded-xl bg-white object-cover shadow-sm" />}
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-display text-base font-semibold text-navy">Mejórala <span className="text-sm font-normal text-muted">(opcional)</span></p>
            {value?.kind === 'portada' ? (
              <p className="text-sm text-muted">La portada va tal cual. Súbela como foto para mejorarla.</p>
            ) : !aiReady ? (
              <p className="rounded-xl bg-[#FFF4CC] px-3 py-2 text-sm text-navy">La mejora con IA llega pronto. Puedes usar tu foto tal cual.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {PHOTO_STYLES.map((s) => {
                  const rec = recommended.get(s.id);
                  const name = s.id === 'temporada' && season ? `${s.label}: ${SEASON_LABEL[season]}` : s.label;
                  return (
                    <button key={s.id} type="button" disabled={pending || noQuota} onClick={() => enhance(s.id)}
                      className={cn('flex min-h-[44px] flex-col items-start gap-1 rounded-xl border-[1.5px] bg-white p-3 text-left transition hover:border-navy disabled:opacity-60', rec ? 'border-[#E0B400]' : 'border-[#C9D6E3]')}>
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                        {busy === s.id ? 'Mejorando… (hasta 40 s)' : name}
                        {rec && busy !== s.id && <span className="rounded-full bg-[#FFF3CC] px-2 py-0.5 text-[11px] font-semibold text-[#7A5A00]">Recomendado</span>}
                      </span>
                      <span className="text-xs text-muted">{rec?.why ?? s.hint}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {noQuota && value?.kind === 'photo' && aiReady && <p className="text-sm text-muted">Ya usaste tus mejoras de este mes. Tus fotos siguen disponibles tal cual.</p>}
            <p className="text-xs text-muted">Buena luz y producto al centro. La original se conserva.</p>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className={cn('text-sm', error ? 'font-medium text-bad' : 'sr-only')}>{error ?? ''}</p>
    </Card>
  );
}
