'use client';

import { useEffect, useRef, useState } from 'react';

const EVENT = 'stampa:caja-flash';

/** Muestra un aviso de éxito en el <FlashRegion /> de la pantalla. */
export function flash(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

/**
 * Aviso flotante abajo de la pantalla (no empuja el contenido ni el QR). Una sola instancia por página.
 * Se cierra solo a los 6 s o con la X.
 */
export function FlashRegion() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setText(null), 6000);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer.current); };
  }, []);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:bottom-6">
      {text && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#12683F] py-2 pl-4 pr-2 text-white shadow-card">
          <svg aria-hidden viewBox="0 0 20 20" className="h-6 w-6 shrink-0"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".2" /><path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p className="min-w-0 flex-1 py-1.5 text-[15px] font-semibold">{text}</p>
          <button type="button" onClick={() => setText(null)} aria-label="Cerrar aviso"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
