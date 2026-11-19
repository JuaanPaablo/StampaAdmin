'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Cuenta regresiva en vivo (cada segundo) hasta expiresAt. */
export function Countdown({ expiresAt, createdAt, active }: { expiresAt: string; createdAt: string; active: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const end = new Date(expiresAt).getTime();
  const total = Math.max(1, end - new Date(createdAt).getTime());
  const left = now === null ? null : end - now;
  const low = left !== null && left <= 60_000;

  let announce = '';
  if (left !== null && active) {
    if (left <= 0) announce = 'El código venció.';
    else if (left <= 10_000) announce = 'Quedan menos de 10 segundos.';
    else if (left <= 30_000) announce = 'Quedan menos de 30 segundos.';
    else if (left <= 60_000) announce = 'Queda menos de un minuto.';
  }

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted">{active ? 'Vence en' : 'Vigencia'}</span>
        <span role="timer" className={cn('font-mono text-2xl font-bold tabular-nums', low && active ? 'text-bad' : 'text-navy')}>
          {active ? (left === null ? '--:--' : fmt(left)) : '00:00'}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', low ? 'bg-bad' : 'bg-navy')}
          style={{ width: (active && left !== null ? Math.max(0, Math.min(1, left / total)) * 100 : 0) + '%' }} />
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
