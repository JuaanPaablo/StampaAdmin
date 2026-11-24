'use client';

import { useEffect } from 'react';

export const UNSAVED_MESSAGE = 'Tienes cambios sin guardar. ¿Salir sin guardar?';

/**
 * Avisa antes de salir con cambios sin guardar: al cerrar o recargar la pestaña (beforeunload) y al tocar un enlace
 * interno a otra página del panel (los enlaces de Next no disparan beforeunload).
 */
export function useUnsavedGuard(dirty: boolean, message: string = UNSAVED_MESSAGE): void {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Misma página (un #ancla o ?tamano=): el estado del formulario se conserva.
      if (url.pathname === window.location.pathname) return;
      if (!window.confirm(message)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, message]);
}
