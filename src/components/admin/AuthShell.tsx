import type { ReactNode } from 'react';
import { Isotipo, Wordmark } from '@/components/shell/logo';

/** Pantalla de acceso de marca: fondo Azul Noche, Wordmark y tarjeta blanca. La usan /admin/ingresar, /invitacion y /restablecer. */
export function AuthShell({ title, subtitle, tag, children, footer }: { title: string; subtitle?: ReactNode; tag?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-navy px-4 py-10 sm:py-14">
      <Isotipo size={460} color="#0F2A4A" dot="#0F2A4A" className="pointer-events-none absolute -bottom-32 -right-40 opacity-70" />
      <div className="relative flex flex-col items-center gap-3">
        <Wordmark size="lg" />
        {tag && <span className="rounded-full bg-sun px-3 py-1 text-[11px] font-bold uppercase leading-none tracking-wider text-navy">{tag}</span>}
      </div>
      <section className="relative mt-8 w-full max-w-[420px] rounded-3xl bg-white px-5 py-7 shadow-[0_20px_50px_rgba(0,0,0,.35)] sm:px-8 sm:py-9">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-navy">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</div>}
        <div className="mt-7">{children}</div>
      </section>
      {footer && <div className="relative mt-6 text-center text-sm text-white/75">{footer}</div>}
      <p className="relative mt-auto pt-10 text-xs text-white/50">© {new Date().getFullYear()} Stampa · Cada visita cuenta.</p>
    </main>
  );
}
