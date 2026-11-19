'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { btnClass } from '@/components/ui';

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-card ring-1 ring-line/70">
      <h1 className="font-display text-xl font-bold text-navy">Algo no salió como esperábamos</h1>
      <p className="mt-2 text-sm text-muted">No pudimos cargar esta pantalla. Tus datos están a salvo. Inténtalo de nuevo y, si el problema sigue, vuelve al inicio del panel.</p>
      {error.digest && <p className="mt-3 text-xs text-muted">Código de referencia: <span className="font-mono">{error.digest}</span></p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className={btnClass('primary')}>Reintentar</button>
        <Link href="/panel" className={btnClass('ghost')}>Ir al inicio</Link>
      </div>
    </div>
  );
}
