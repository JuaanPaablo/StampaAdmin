'use client';

import { useId, useState, useTransition } from 'react';
import { btnClass, inputClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { googleMapsUrl, parseCoordsInput } from '@/lib/domain/wallet-cards';
import { setLocationCoordsAction } from '../actions';

type Coords = { latitude: number; longitude: number };

/** Mensaje claro para cada error de navigator.geolocation. */
function geoError(code: number): string {
  if (code === 1) return 'No diste permiso para usar tu ubicación. Actívalo en el candado de la barra de direcciones, o pega un enlace de Google Maps.';
  if (code === 3) return 'Tu celular tardó demasiado en encontrar la ubicación. Intenta de nuevo cerca de una ventana o pega un enlace de Google Maps.';
  return 'No pudimos obtener tu ubicación. Pega un enlace de Google Maps o escribe la latitud y longitud.';
}

/**
 * Ubicación de una sucursal para los avisos de cercanía: "Usar mi ubicación actual" (estando en el local), pegar un
 * enlace de Google Maps o escribir "lat, long". Muestra el punto con un enlace a Google Maps. Sin librerías de mapas.
 */
export function LocationCoords({ locationId, locationName, initial }: { locationId: string; locationName: string; initial: Coords | null }) {
  const uid = useId();
  const [saved, setSaved] = useState<Coords | null>(initial);
  const [editing, setEditing] = useState(!initial);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();
  const busy = pending || locating;

  function save(c: Coords | null) {
    const fd = new FormData();
    fd.set('id', locationId);
    if (c) { fd.set('latitude', String(c.latitude)); fd.set('longitude', String(c.longitude)); } else fd.set('clear', '1');
    start(async () => {
      const r = await setLocationCoordsAction(fd);
      if (!r.ok) { setMsg({ ok: false, text: r.error ?? 'No pudimos guardar la ubicación.' }); return; }
      setSaved(c);
      setEditing(!c);
      setText('');
      setMsg({ ok: true, text: r.message ?? 'Listo.' });
    });
  }

  function useCurrent() {
    setMsg(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMsg({ ok: false, text: 'Este navegador no puede dar tu ubicación. Pega un enlace de Google Maps.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        save({ latitude: Math.round(pos.coords.latitude * 1e6) / 1e6, longitude: Math.round(pos.coords.longitude * 1e6) / 1e6 });
      },
      (err) => { setLocating(false); setMsg({ ok: false, text: geoError(err.code) }); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function savePasted() {
    setMsg(null);
    const raw = text.trim();
    if (!raw) { setMsg({ ok: false, text: 'Pega un enlace de Google Maps o escribe la latitud y longitud.' }); return; }
    const c = parseCoordsInput(raw);
    if (!c) {
      setMsg({ ok: false, text: /goo\.gl|maps\.app/i.test(raw)
        ? 'Ese enlace corto no trae la ubicación. Ábrelo, espera que cargue el mapa y copia el enlace largo de la barra de direcciones.'
        : 'No encontramos coordenadas ahí. Ejemplo válido: -2.170998, -79.922359' });
      return;
    }
    save(c);
  }

  const inputId = `${uid}-coords`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-navy">Ubicación en el mapa</p>
      {saved && !editing ? (
        <div className="flex flex-col gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-navy">
            <span aria-hidden="true">📍 </span>Ubicada en <span className="font-mono tabular-nums">{saved.latitude}, {saved.longitude}</span>
            {' · '}
            <a href={googleMapsUrl(saved.latitude, saved.longitude)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              Ver en Google Maps<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setMsg(null); setEditing(true); }} disabled={busy} className={btnClass('ghost', 'sm')}>Cambiar<span className="sr-only"> ubicación de {locationName}</span></button>
            <button type="button" onClick={() => save(null)} disabled={busy} className={btnClass('danger', 'sm')}>{pending ? 'Quitando…' : 'Quitar'}<span className="sr-only"> ubicación de {locationName}</span></button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <button type="button" onClick={useCurrent} disabled={busy} className={btnClass('dark')}>
              {locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}
            </button>
            <p className="mt-1 text-xs text-muted">Hazlo estando dentro del local. Tu navegador te pedirá permiso para ver tu ubicación: toca «Permitir».</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-xs font-semibold tracking-wide text-muted">O pega un enlace de Google Maps, o escribe «latitud, longitud»</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id={inputId} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); savePasted(); } }}
                placeholder="https://www.google.com/maps/@-2.17,-79.92,17z  o  -2.170998, -79.922359" autoComplete="off" inputMode="url"
                aria-invalid={msg && !msg.ok ? true : undefined} aria-describedby={`${uid}-msg`} className={cn(inputClass, 'min-w-0 sm:flex-1')} />
              <button type="button" onClick={savePasted} disabled={busy} className={btnClass('primary')}>{pending ? 'Guardando…' : 'Guardar ubicación'}</button>
            </div>
          </div>
          {saved && <button type="button" onClick={() => { setMsg(null); setEditing(false); }} disabled={busy} className={cn(btnClass('ghost', 'sm'), 'self-start')}>Cancelar</button>}
        </div>
      )}
      <p id={`${uid}-msg`} role="status" aria-live="polite" className={cn('text-sm empty:hidden', msg?.ok ? 'text-good' : 'text-bad')}>{msg?.text ?? ''}</p>
    </div>
  );
}
