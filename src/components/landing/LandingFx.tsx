'use client';

import { useEffect } from 'react';

/** Borde del encabezado al hacer scroll y cierre del menú móvil. Sin animaciones de aparición: el único momento es la tarjeta. */
export function LandingFx() {
  useEffect(() => {
    const hdr = document.querySelector('.lp .hdr');
    const onScroll = () => hdr?.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const menu = document.querySelector<HTMLDetailsElement>('.lp .menu');
    const close = (ev: Event) => { if ((ev.target as HTMLElement).closest('a')) menu?.removeAttribute('open'); };
    menu?.addEventListener('click', close);
    return () => { window.removeEventListener('scroll', onScroll); menu?.removeEventListener('click', close); };
  }, []);
  return null;
}

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.lpTheme === 'dark' ? 'light' : 'dark';
    root.dataset.lpTheme = next;
    try { localStorage.setItem('stampa-lp-theme', next); } catch { /* sin almacenamiento */ }
  }
  return (
    <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label="Cambiar entre modo claro y oscuro" title="Modo claro u oscuro">
      <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7Z" /></svg>
      <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
    </button>
  );
}

/** Antes de pintar: tema guardado (claro por defecto). */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('stampa-lp-theme');document.documentElement.dataset.lpTheme=t==='dark'?'dark':'light';}catch(e){document.documentElement.dataset.lpTheme='light';}`;
