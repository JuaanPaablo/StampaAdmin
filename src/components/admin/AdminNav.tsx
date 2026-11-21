'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Isotipo } from '@/components/shell/logo';
import { adminSignOut } from '@/lib/admin-actions';

const ITEMS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/negocios', label: 'Negocios' },
  { href: '/admin/cuenta', label: 'Mi cuenta' }
];

/**
 * Barra del panel de administrador: arriba y horizontal (distinta de la barra lateral del panel del dueño).
 * En móvil las pestañas van en una segunda fila; no necesita menú desplegable.
 */
export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname() ?? '';
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <header className="sticky top-0 z-30 bg-navy text-white shadow-[0_1px_0_rgba(255,255,255,.08)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-sun focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy">
        Saltar al contenido
      </a>
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
        <Link href="/admin" className="inline-flex shrink-0 items-center gap-2 rounded-lg" aria-label="Stampa, administración: inicio">
          <Isotipo size={26} />
          <span className="font-display text-lg font-bold tracking-tight">stampa</span>
        </Link>
        <span className="rounded-full bg-sun px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wider text-navy">Administración</span>

        <nav aria-label="Administración" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {ITEMS.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href} aria-current={isActive(it.href) ? 'page' : undefined}
                  className={'inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition ' + (isActive(it.href) ? 'bg-white text-navy' : 'text-white/80 hover:bg-white/10 hover:text-white')}
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-xs text-white/65 md:inline" title={email}>{email}</span>
          <form action={adminSignOut}>
            <button type="submit" className="h-9 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white hover:bg-white/20">Salir</button>
          </form>
        </div>
      </div>

      <nav aria-label="Administración" className="border-t border-white/10 lg:hidden">
        <ul className="mx-auto flex w-full max-w-[1200px] gap-1 px-2 sm:px-4">
          {ITEMS.map((it) => (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href} aria-current={isActive(it.href) ? 'page' : undefined}
                className={'flex h-12 items-center justify-center border-b-[3px] text-sm font-medium ' + (isActive(it.href) ? 'border-sun text-white' : 'border-transparent text-white/70 hover:text-white')}
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
