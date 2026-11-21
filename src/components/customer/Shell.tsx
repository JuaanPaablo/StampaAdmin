import Link from 'next/link';
import type { ReactNode } from 'react';
import { Isotipo } from '@/components/shell/logo';

/**
 * Marco de las páginas del cliente: móvil primero, sin la navegación del panel. Stampa firma discretamente al pie.
 * `wide`: en computadora (lg) el marco se ensancha para usar dos columnas con <Split>.
 */
export function CustomerShell({ children, top, wide }: { children: ReactNode; top?: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-surface text-navy">
      <div className={`mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-8 pt-4 lg:pt-10 ${wide ? 'lg:max-w-5xl lg:px-8' : ''}`}>
        {top}
        <main className="flex-1">{children}</main>
        <footer className="mt-10 flex flex-col items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
            con <Isotipo size={18} color="#001D3D" /> <span className="font-display font-bold">Stampa</span>
          </span>
          <nav aria-label="Información legal" className="flex gap-4">
            <Link href="/privacidad" className="underline underline-offset-2 hover:text-navy">Privacidad</Link>
            <Link href="/terminos" className="underline underline-offset-2 hover:text-navy">Términos</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** En móvil, una columna. En computadora: la tarjeta del negocio a la izquierda (fija al desplazar) y el formulario a la derecha. */
export function Split({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div className="lg:sticky lg:top-10">{aside}</div>
      <div className="mt-4 lg:mt-0">{children}</div>
    </div>
  );
}

/** Logo del negocio (imagen o iniciales). */
export function BusinessLogo({ url, initials, bg, ink, size = 56 }: { url?: string; initials: string; bg: string; ink: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-display font-bold ring-2 ring-white/70"
      style={{ width: size, height: size, background: bg, color: ink, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        : initials}
    </span>
  );
}

/** Aviso destacado (éxito, información o error). */
export function Notice({ tone = 'info', title, children }: { tone?: 'success' | 'info' | 'warning' | 'error'; title?: string; children?: ReactNode }) {
  const cls = {
    success: 'bg-sun text-navy',
    info: 'bg-white text-navy ring-1 ring-line',
    warning: 'bg-[#FFF4CC] text-navy ring-1 ring-sun',
    error: 'bg-[#FDECEA] text-[#8A1F18] ring-1 ring-[#F3B9B4]'
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={'rounded-2xl px-4 py-3 text-sm ' + cls}>
      {title && <p className="font-display text-base font-bold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

export const primaryBtn =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sun px-5 text-base font-semibold text-navy transition hover:bg-sun-2 disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryBtn =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-navy ring-1 ring-[#C9D6E3] transition hover:bg-surface disabled:opacity-60';
export const linkBtn = 'inline-flex min-h-12 items-center justify-center px-2 text-sm font-semibold text-navy underline underline-offset-4 hover:text-navy-3';
export const fieldInput =
  'h-12 w-full rounded-xl border-[1.5px] border-[#C9D6E3] bg-white px-3.5 text-base text-navy placeholder:text-[#6B819A] focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50 aria-[invalid=true]:border-bad';
