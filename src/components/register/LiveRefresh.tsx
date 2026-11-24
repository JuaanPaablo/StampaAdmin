'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type WakeLockLike = { release(): Promise<void> };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> } };

/**
 * Mantiene la pantalla al día: router.refresh() cada 3 s mientras el código esté activo.
 * Además refresca una vez en cuanto vence el reloj local, sin esperar al siguiente ciclo,
 * y evita que la tablet o el celular apaguen la pantalla mientras el QR está a la vista.
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

  // Pantalla encendida mientras el código esté activo (si el navegador lo permite).
  useEffect(() => {
    if (!active) return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;
    let lock: WakeLockLike | null = null;
    let done = false;
    const request = async () => {
      if (document.hidden || done) return;
      try {
        const l = await nav.wakeLock!.request('screen');
        if (done) l.release().catch(() => {}); else lock = l;
      } catch { /* sin permiso o sin batería: seguimos sin bloqueo */ }
    };
    const onVisible = () => { if (!document.hidden) request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);

  return null;
}
