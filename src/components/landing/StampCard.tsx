'use client';

import { useEffect, useRef, useState } from 'react';

const TOTAL = 10;
const INTRO = 4;

/** Isotipo dentro de cada sello: la tarjeta perforada en Azul Noche. */
function Mark() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M56.10 19.98A38 38 0 1 0 80.02 43.90A22 22 0 0 1 56.10 19.98Z" fill="#001D3D" />
    </svg>
  );
}

/**
 * Tarjeta de sellos que el visitante puede sellar. Al cargar recibe 4 sellos (único movimiento automático de la página);
 * cada toque suma uno y en el 10 aparece el premio.
 */
export function StampCard() {
  const [stamps, setStamps] = useState(0);
  const [last, setLast] = useState(-1);
  const done = stamps >= TOTAL;
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setStamps(INTRO); return; }
    for (let i = 1; i <= INTRO; i++) {
      timers.current.push(window.setTimeout(() => { setStamps(i); setLast(i - 1); }, 500 + i * 320));
    }
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  function stamp() {
    if (done) { setStamps(0); setLast(-1); return; }
    setLast(stamps);
    setStamps((s) => Math.min(TOTAL, s + 1));
  }

  const left = TOTAL - stamps;
  return (
    <div className="sc">
      <button type="button" className={'sc-card' + (done ? ' is-done' : '')} onClick={stamp} aria-describedby="sc-status">
        <span className="sc-head">
          <span className="sc-logo" aria-hidden="true">PN</span>
          <span><b>Pizzería Napoli</b><small>Tarjeta de pizzas</small></span>
          <span className="sc-count" aria-hidden="true">{stamps}<i>/{TOTAL}</i></span>
        </span>
        <span className="sc-grid" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => {
            const on = i < stamps;
            const gift = i === TOTAL - 1;
            return (
              <span key={i} className={'sc-slot' + (on ? ' on' : '') + (gift ? ' gift' : '') + (on && i === last ? ' just' : '')}>
                {on ? <Mark /> : gift ? <GiftIcon /> : i + 1}
              </span>
            );
          })}
        </span>
        <span className="sc-bar" aria-hidden="true"><i style={{ width: `${(stamps / TOTAL) * 100}%` }} /></span>
      </button>
      <p id="sc-status" className="sc-status" aria-live="polite">
        {done
          ? <><b>¡Premio listo!</b> Una pizza mediana, cortesía de la casa. Toca para empezar otra tarjeta.</>
          : <>Te {left === 1 ? 'falta 1 sello' : `faltan ${left} sellos`} para tu pizza gratis. <span className="sc-hint">Toca la tarjeta para sellar.</span></>}
      </p>
    </div>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="8" width="17" height="4.5" rx="1" /><path d="M5 12.5V20h14v-7.5M12 8v12M12 8S10.6 3.8 8.3 5c-1.9 1 .3 3 3.7 3Zm0 0s1.4-4.2 3.7-3c1.9 1-.3 3-3.7 3Z" />
    </svg>
  );
}
