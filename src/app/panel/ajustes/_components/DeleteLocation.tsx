'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { btnClass } from '@/components/ui';
import { deleteLocationAction } from '../actions';

/**
 * Eliminar una sucursal en dos pasos: primero se explica qué pasa y luego se confirma.
 * Evita borrarla por un toque accidental en el celular.
 */
export function DeleteLocation({ id, name, staffCount }: { id: string; name: string; staffCount: number }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  // Foco al botón seguro (Cancelar) al abrir, y de vuelta al botón original al cerrar.
  useEffect(() => {
    if (asking) cancelRef.current?.focus();
    else if (wasAsking.current) openRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  function confirm() {
    setError(null);
    const fd = new FormData();
    fd.set('id', id);
    start(async () => {
      const r = await deleteLocationAction(fd);
      if (!r.ok) setError(r.error ?? 'No pudimos eliminar la sucursal. Inténtalo de nuevo.');
    });
  }

  if (!asking) {
    return (
      <button ref={openRef} type="button" onClick={() => setAsking(true)} className={btnClass('danger')}>
        Eliminar<span className="sr-only"> {name}</span>
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby={`del-${id}-t`} aria-describedby={`del-${id}-d`}
      className="w-full rounded-xl bg-[#FBE0DE] p-4 text-[#9B2A22]"
      onKeyDown={(e) => { if (e.key === 'Escape' && !pending) setAsking(false); }}>
      <p id={`del-${id}-t`} className="font-semibold">¿Eliminar {name}?</p>
      <p id={`del-${id}-d`} className="mt-1 text-sm">
        Deja de aparecer en el panel. Los sellos que ya dio se conservan.
        {staffCount > 0 && <> {staffCount === 1 ? 'Hay 1 persona asignada' : `Hay ${staffCount} personas asignadas`}: cámbialas de sucursal en Equipo.</>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={pending} aria-busy={pending}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#9B2A22] px-5 text-sm font-semibold text-white transition hover:bg-[#7F2019] disabled:opacity-50">{pending ? 'Eliminando…' : 'Sí, eliminar'}</button>
        <button ref={cancelRef} type="button" onClick={() => setAsking(false)} disabled={pending} className={btnClass('ghost')}>Cancelar</button>
      </div>
      <p role="alert" className="mt-2 text-sm font-medium empty:hidden">{error ?? ''}</p>
    </div>
  );
}
