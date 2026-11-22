'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeImageAction, saveFramingAction, uploadImageAction } from '@/app/panel/tarjeta/actions';
import { btnClass } from '@/components/ui';
import type { ImageFraming } from '@/lib/contracts';
import { cleanFraming, framingStyle } from '@/lib/rewards';
import { IMAGE_ACCEPT, checkImageFile, safeImageUrl, type ImageKind } from './images';

/**
 * Subir, ver, ajustar (arrastrar y zoom) y quitar el logo o la portada. Sube apenas eliges el archivo (server action
 * con FormData) y refresca la página para que la vista previa y el póster usen la imagen guardada. No usa <form>: puede
 * ir dentro de otro formulario.
 */
export function ImageUpload({ kind, label, help, currentUrl, fallback, framing }: {
  kind: ImageKind; label: string; help?: string; currentUrl?: string; fallback?: string; framing?: Partial<ImageFraming>;
}) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: ImageFraming } | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [adjusting, setAdjusting] = useState(false);
  const saved = cleanFraming(framing);
  const [f, setF] = useState<ImageFraming>(saved);
  const savedUrl = safeImageUrl(currentUrl);
  const shown = local ?? savedUrl;

  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  // Cuando llega un encuadre nuevo del servidor (otra imagen, otro guardado), se toma como punto de partida.
  useEffect(() => { if (!adjusting) setF(cleanFraming(framing)); }, [framing?.x, framing?.y, framing?.zoom, adjusting]); // eslint-disable-line react-hooks/exhaustive-deps

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null); setAdjusting(false);
    const err = checkImageFile(file);
    if (err) { setError(err); return; }
    setError(null);
    const preview = URL.createObjectURL(file);
    setLocal(preview);
    setF(cleanFraming(undefined));
    const fd = new FormData();
    fd.set('kind', kind);
    fd.set('file', file);
    start(async () => {
      try {
        const res = await uploadImageAction(fd);
        if (!res.ok) { setError(res.error ?? 'No pudimos subir la imagen.'); setLocal(null); return; }
        setMessage('Imagen guardada. Puedes ajustar su posición.');
        router.refresh();
      } catch {
        setError('No pudimos subir la imagen. Prueba con una más liviana o intenta de nuevo.');
        setLocal(null);
      }
    });
  }

  function onRemove() {
    setMessage(null); setError(null); setAdjusting(false);
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

  function saveFraming() {
    const fd = new FormData();
    fd.set('kind', kind); fd.set('x', String(f.x)); fd.set('y', String(f.y)); fd.set('zoom', String(f.zoom));
    setError(null); setMessage(null);
    start(async () => {
      try {
        const res = await saveFramingAction(fd);
        if (!res.ok) { setError(res.error ?? 'No pudimos guardar el encuadre.'); return; }
        setAdjusting(false);
        setMessage('Encuadre guardado.');
        router.refresh();
      } catch {
        setError('No pudimos guardar el encuadre. Intenta de nuevo.');
      }
    });
  }

  /* Arrastrar: mover el dedo a la derecha muestra más de la izquierda de la imagen (como mover una foto). */
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!adjusting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: f };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const k = 100 / Math.max(1, d.start.zoom);
    setF(cleanFraming({ ...d.start, x: d.start.x - ((e.clientX - d.x) / box.width) * k * 1.5, y: d.start.y - ((e.clientY - d.y) / box.height) * k * 1.5 }));
  }
  function onPointerUp() { drag.current = null; }
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!adjusting) return;
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, Partial<ImageFraming>> = {
      ArrowLeft: { x: f.x + step }, ArrowRight: { x: f.x - step }, ArrowUp: { y: f.y + step }, ArrowDown: { y: f.y - step }
    };
    if (moves[e.key]) { e.preventDefault(); setF(cleanFraming({ ...f, ...moves[e.key] })); }
  }

  const isLogo = kind === 'logo';
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-xs font-semibold tracking-wide text-muted">{label} <span className="font-normal">(opcional)</span></span>
      <div className={isLogo ? 'flex flex-wrap items-center gap-4' : 'flex flex-col gap-3'}>
        <div
          ref={frameRef}
          role={adjusting ? 'application' : undefined}
          aria-label={adjusting ? 'Arrastra la imagen o usa las flechas para moverla' : undefined}
          tabIndex={adjusting ? 0 : undefined}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKey}
          className={
            'relative grid shrink-0 touch-none select-none place-items-center overflow-hidden bg-surface ring-inset ' +
            (adjusting ? 'cursor-grab ring-2 ring-navy active:cursor-grabbing ' : 'ring-1 ring-[#C9D6E3] ') +
            (isLogo ? 'h-24 w-24 rounded-full' : 'aspect-[3/1] w-full rounded-xl')
          }
        >
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt={isLogo ? 'Vista previa del logo' : 'Vista previa de la portada'} draggable={false}
                className={'pointer-events-none h-full w-full object-cover ' + (pending ? 'opacity-60' : '')} style={framingStyle(f)} />
            : <span className="px-2 text-center text-xs font-semibold text-muted">{isLogo ? (fallback || 'Logo') : 'Sin portada'}</span>}
          {pending && <span className="absolute inset-0 grid place-items-center bg-white/40 text-xs font-semibold text-navy">Guardando…</span>}
        </div>
        {!adjusting ? (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} id={id} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={onPick}
              aria-labelledby={`${id}-label`} aria-describedby={`${id}-help${error ? ` ${id}-err` : ''}`} disabled={pending} />
            <button type="button" className={btnClass('dark', 'sm')} onClick={() => inputRef.current?.click()} disabled={pending}>
              {savedUrl ? 'Cambiar' : 'Subir imagen'}
            </button>
            {savedUrl && !local && (
              <button type="button" className={btnClass('ghost', 'sm')} onClick={() => { setMessage(null); setAdjusting(true); }} disabled={pending}>Ajustar</button>
            )}
            {savedUrl && (
              <button type="button" className={btnClass('ghost', 'sm')} onClick={onRemove} disabled={pending}>Quitar</button>
            )}
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
            <label className="flex items-center gap-3 text-xs font-semibold text-muted">
              Zoom
              <input type="range" min={1} max={3} step={0.05} value={f.zoom} onChange={(e) => setF(cleanFraming({ ...f, zoom: Number(e.target.value) }))}
                className="w-full accent-[#001D3D]" aria-label="Zoom de la imagen" />
            </label>
            <p className="text-xs text-muted">Arrastra la imagen para moverla.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnClass('dark', 'sm')} onClick={saveFraming} disabled={pending}>Guardar encuadre</button>
              <button type="button" className={btnClass('ghost', 'sm')} onClick={() => setF(cleanFraming(undefined))} disabled={pending}>Centrar</button>
              <button type="button" className={btnClass('ghost', 'sm')} onClick={() => { setAdjusting(false); setF(saved); }} disabled={pending}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      <p id={`${id}-help`} className="text-xs leading-relaxed text-muted">{help ?? 'Máximo 2 MB.'}</p>
      <p role="status" aria-live="polite" className="min-h-[1rem] text-xs">
        {error ? <span id={`${id}-err`} className="font-medium text-bad">{error}</span> : message ? <span className="font-medium text-[#12683F]">{message}</span> : null}
      </p>
    </div>
  );
}
