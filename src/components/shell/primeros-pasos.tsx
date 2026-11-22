'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const STEPS = [
  { href: '/panel/tarjeta/poster', title: 'Descarga tu póster QR', text: 'Imprímelo y ponlo a la vista.' },
  { href: '/panel/equipo', title: 'Invita a tu equipo', text: 'Cada uno entra con su correo.' },
  { href: '/panel/caja', title: 'Da el primer sello', text: 'Pruébalo con tu teléfono.' }
];

/**
 * Aviso de bienvenida. Aparece cuando la URL trae ?bienvenida=1 (al terminar el asistente de /bienvenida).
 * Usa useSearchParams: renderízalo dentro de <Suspense>. El layout del panel ya lo hace.
 */
export function PrimerosPasos() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (params?.get('bienvenida') !== '1' || hidden) return null;

  function dismiss() {
    setHidden(true);
    const next = new URLSearchParams(params?.toString());
    next.delete('bienvenida');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <section aria-labelledby="primeros-pasos-t" className="mb-6 rounded-2xl bg-navy p-5 text-white shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="primeros-pasos-t" className="font-display text-xl font-bold tracking-tight">¡Tu negocio ya está activo!</h2>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold text-white/80 ring-1 ring-inset ring-white/25 hover:bg-white/10">
          Ocultar
        </button>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full gap-3 rounded-xl bg-white/10 p-4 transition hover:bg-white/15">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sun font-display text-sm font-bold text-navy">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-white/70">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
