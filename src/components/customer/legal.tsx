import Link from 'next/link';
import type { ReactNode } from 'react';
import { CustomerShell } from './Shell';

/**
 * Datos legales de Stampa. FALTAN los datos reales: el cliente aún no los entregó.
 * Cámbialos SOLO aquí; se muestran en /privacidad y /terminos.
 */
export const LEGAL = {
  razonSocial: '[RAZÓN SOCIAL DE STAMPA]',
  ruc: '[RUC]',
  correo: '[CORREO DE CONTACTO]',
  actualizado: 'Última actualización: noviembre de 2026'
} as const;

/** Resalta los marcadores pendientes para que nadie los pase por alto. */
export function Placeholder({ children }: { children: string }) {
  const pending = children.startsWith('[');
  return pending ? <mark className="rounded bg-[#FFF4CC] px-1 font-semibold text-navy">{children}</mark> : <>{children}</>;
}

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <CustomerShell>
      <article className="mt-2 rounded-3xl bg-white px-5 py-6 text-[15px] leading-relaxed text-navy shadow-card ring-1 ring-line/70">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{LEGAL.actualizado}</p>
        <div className="mt-4">{intro}</div>
        <div className="mt-2 space-y-1 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1">
          {children}
        </div>
        <p className="mt-8 text-sm text-muted">
          ¿Dudas? Escríbenos a <Placeholder>{LEGAL.correo}</Placeholder>. Revisa también{' '}
          <Link href="/privacidad" className="font-semibold underline underline-offset-2">Privacidad</Link> y{' '}
          <Link href="/terminos" className="font-semibold underline underline-offset-2">Términos</Link>.
        </p>
      </article>
    </CustomerShell>
  );
}
