'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeImageAction, uploadImageAction } from '@/app/panel/tarjeta/actions';
import { btnClass } from '@/components/ui';
import { IMAGE_ACCEPT, checkImageFile, safeImageUrl, type ImageKind } from './images';

/**
 * Subir, ver y quitar el logo o la portada. Sube apenas eliges el archivo (server action con FormData) y refresca la
 * página para que la vista previa y el póster usen la imagen guardada. No usa <form>: puede ir dentro de otro formulario.
 */
export function ImageUpload({ kind, label, help, currentUrl, fallback }: {
  kind: ImageKind; label: string; help?: string; currentUrl?: string; fallback?: string;
}) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = safeImageUrl(currentUrl);
  const shown = local ?? saved;

  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    const err = checkImageFile(file);
    if (err) { setError(err); return; }
    setError(null);
    const preview = URL.createObjectURL(file);
    setLocal(preview);
    const fd = new FormData();
    fd.set('kind', kind);
    fd.set('file', file);
    start(async () => {
      try {
        const res = await uploadImageAction(fd);
        if (!res.ok) { setError(res.error ?? 'No pudimos subir la imagen.'); setLocal(null); return; }
        setMessage('Imagen guardada.');
        router.refresh();
      } catch {
        setError('No pudimos subir la imagen. Prueba con una más liviana o intenta de nuevo.');
        setLocal(null);
      }
    });
  }

  function onRemove() {
    setMessage(null); setError(null);
    const fd = new FormData();
    fd.set('kind', kind);
    start(async () => {
      try {
        const res = await removeImageAction(fd);
        if (!res.ok) { setError(res.error ?? 'No pudimos quitar la imagen.'); return; }
        setLocal(null);
        setMessage(kind === 'logo' ? 'Logo quitado. Se usan tus iniciales.' : 'Portada quitada.');
        router.refresh();
      } catch {
        setError('No pudimos quitar la imagen. Intenta de nuevo.');
      }
    });
  }

  const isLogo = kind === 'logo';
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-xs font-semibold tracking-wide text-muted">{label} <span className="font-normal">(opcional)</span></span>
      <div className={isLogo ? 'flex items-center gap-4' : 'flex flex-col gap-3'}>
        <div
          className={
            'relative grid shrink-0 place-items-center overflow-hidden bg-surface ring-1 ring-inset ring-[#C9D6E3] ' +
            (isLogo ? 'h-20 w-20 rounded-full' : 'aspect-[3/1] w-full rounded-xl')
          }
        >
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt={isLogo ? 'Vista previa del logo' : 'Vista previa de la portada'} className={'h-full w-full object-cover ' + (pending ? 'opacity-60' : '')} />
            : <span className="px-2 text-center text-xs font-semibold text-muted">{isLogo ? (fallback || 'Logo') : 'Sin portada'}</span>}
          {pending && <span className="absolute inset-0 grid place-items-center bg-white/40 text-xs font-semibold text-navy">Guardando…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} id={id} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={onPick}
            aria-labelledby={`${id}-label`} aria-describedby={`${id}-help${error ? ` ${id}-err` : ''}`} disabled={pending} />
          <button type="button" className={btnClass('dark', 'sm')} onClick={() => inputRef.current?.click()} disabled={pending}>
            {saved ? 'Cambiar' : 'Subir imagen'}
          </button>
          {saved && (
            <button type="button" className={btnClass('ghost', 'sm')} onClick={onRemove} disabled={pending}>Quitar</button>
          )}
        </div>
      </div>
      <p id={`${id}-help`} className="text-xs leading-relaxed text-muted">{help ?? 'PNG, JPG o WEBP. Máximo 2 MB.'}</p>
      <p role="status" aria-live="polite" className="min-h-[1rem] text-xs">
        {error ? <span id={`${id}-err`} className="font-medium text-bad">{error}</span> : message ? <span className="font-medium text-[#12683F]">{message}</span> : null}
      </p>
    </div>
  );
}
