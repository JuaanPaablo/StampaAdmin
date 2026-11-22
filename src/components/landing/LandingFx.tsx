'use client';

import { useEffect } from 'react';

/** Aparición al hacer scroll y sombra del encabezado. El tema se aplica antes de pintar con THEME_SCRIPT. */
export function LandingFx() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp [data-reveal]'));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach((el) => io.observe(el));

    const hdr = document.querySelector('.lp .hdr');
    const onScroll = () => hdr?.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Cierra el menú móvil al tocar un enlace.
    const menu = document.querySelector<HTMLDetailsElement>('.lp .menu');
    const close = (ev: Event) => { if ((ev.target as HTMLElement).closest('a')) menu?.removeAttribute('open'); };
    menu?.addEventListener('click', close);
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); menu?.removeEventListener('click', close); };
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
    <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label="Cambiar entre modo claro y oscuro" title="Modo claro / oscuro">
      <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}

/** Se ejecuta antes de pintar: aplica el tema guardado (claro por defecto) y activa las animaciones. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('stampa-lp-theme');document.documentElement.dataset.lpTheme=t==='dark'?'dark':'light';}catch(e){document.documentElement.dataset.lpTheme='light';}document.documentElement.classList.add('lp-js');`;
