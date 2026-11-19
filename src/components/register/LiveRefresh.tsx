'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mantiene la pantalla al día: router.refresh() cada 3 s mientras el código esté activo.
 * Además refresca una vez en cuanto vence el reloj local, sin esperar al siguiente ciclo.
 */
export function LiveRefresh({ active, expiresAt, everyMs = 3000 }: { active: boolean; expiresAt: string; everyMs?: number }) {
  const router = useRouter();
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const tick = () => { if (!document.hidden) router.refresh(); };
    const id = setInterval(tick, everyMs);
    const onVisible = () => { if (!document.hidden) router.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, everyMs, router]);

  useEffect(() => {
    if (!active) { expiredRef.current = false; return; }
    const ms = new Date(expiresAt).getTime() - Date.now();
    const t = setTimeout(() => { expiredRef.current = true; router.refresh(); }, Math.max(0, ms) + 300);
    return () => clearTimeout(t);
  }, [active, expiresAt, router]);

  return null;
}
