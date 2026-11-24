'use client';

import { useState } from 'react';
import { btnClass } from '@/components/ui';

/** Copia la dirección pública con aviso visible y anunciado; si el navegador no deja, explica cómo hacerlo a mano. */
export function CopyLink({ text }: { text: string }) {
  const [state, setState] = useState<'ok' | 'fail' | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('ok');
      setTimeout(() => setState(null), 2000);
    } catch {
      setState('fail');
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={btnClass('ghost')}>{state === 'ok' ? '✓ Copiada' : 'Copiar dirección'}</button>
      <span role="status" aria-live="polite" className={state === 'fail' ? 'text-xs font-medium text-bad' : 'sr-only'}>
        {state === 'ok' ? 'Dirección copiada.' : state === 'fail' ? 'No pudimos copiarla: mantén presionada la dirección y elige Copiar.' : ''}
      </span>
    </div>
  );
}
