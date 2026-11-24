'use client';

import { useEffect, useRef } from 'react';
import { flash } from './FlashRegion';

/**
 * Avisa en cuanto entra un reclamo nuevo (LiveRefresh trae los datos cada 3 s):
 * aviso flotante + vibración corta en teléfonos. No avisa de los reclamos que ya estaban al abrir.
 */
export function ClaimNotice({ count, latestName, customers, full }: { count: number; latestName?: string; customers: string; full: boolean }) {
  const prev = useRef(count);

  useEffect(() => {
    const added = count - prev.current;
    prev.current = count;
    if (added <= 0) return;
    const who = added === 1 && latestName ? latestName + ' recibió su sello' : added + ' ' + customers + ' recibieron su sello';
    flash(who + (full ? '. Cupos completos.' : '.'));
    try { navigator.vibrate?.(120); } catch { /* sin vibración */ }
  }, [count, latestName, customers, full]);

  return null;
}
