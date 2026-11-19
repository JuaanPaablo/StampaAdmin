'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { NavItem } from '@/lib/nav';
import { NavIcon } from './nav-icons';
import { Isotipo } from './logo';

export interface ShellNavItem { href: string; label: string; icon: NavItem['icon'] }

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Barra lateral (escritorio) y barra superior con panel desplegable (móvil, menos de 1024 px).
 * Es un solo <aside>: en móvil se desliza y funciona como diálogo modal con foco atrapado, Escape y aria-expanded.
 */
export function ShellNav({ items, businessName, typeLabel, demo, footer, children }: {
  items: ShellNavItem[]; businessName: string; typeLabel: string; demo?: ReactNode; footer: ReactNode; children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Cierra al navegar.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Bloquea el scroll del fondo y lleva el foco al panel mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    asideRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Si se agranda la ventana con el panel abierto, se cierra.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(asideRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const isActive = (href: string) => (href === '/panel' ? pathname === '/panel' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <div className="min-h-screen lg:flex" onKeyDown={onKeyDown}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-sun focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy">
        Saltar al contenido
      </a>

      {/* Barra superior móvil */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-navy px-3 text-white lg:hidden">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="menu-lateral"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <Isotipo size={26} />
        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{businessName}</span>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-navy/60 lg:hidden" aria-hidden="true" onClick={() => close(false)} />}

      <aside
        ref={asideRef}
        id="menu-lateral"
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Menú principal' : undefined}
        className={
          'fixed inset-y-0 left-0 z-40 flex w-[290px] max-w-[88vw] flex-col overflow-y-auto bg-navy text-white transition-[transform,visibility] duration-200 ' +
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:max-w-none lg:shrink-0 lg:visible lg:translate-x-0 ' +
          (open ? 'visible translate-x-0' : 'invisible -translate-x-full')
        }
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <span className="inline-flex items-center gap-2.5">
            <Isotipo size={30} />
            <span className="font-display text-xl font-bold tracking-tight">stampa</span>
          </span>
          <button type="button" onClick={() => close()} aria-label="Cerrar menú" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="mx-4 mb-4 rounded-xl bg-white/5 px-3.5 py-3">
          <p className="break-words font-display text-sm font-semibold leading-snug">{businessName}</p>
          <span className="mt-1.5 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold leading-none text-white/85">{typeLabel}</span>
        </div>

        <nav aria-label="Principal" className="px-3">
          <ul className="flex flex-col gap-1">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ' +
                      (active ? 'bg-white text-navy' : 'text-white/80 hover:bg-white/10 hover:text-white')
                    }
                  >
                    <NavIcon name={it.icon} />
                    <span className="truncate">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-3 px-4 pb-5 pt-6">
          {demo}
          {footer}
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
