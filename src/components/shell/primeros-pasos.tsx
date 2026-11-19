'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const STEPS = [
  { href: '/panel/tarjeta', title: 'Personaliza tu tarjeta', text: 'Ajusta el premio, los sellos necesarios y los colores.' },
  { href: '/panel/equipo', title: 'Invita a tu equipo', text: 'Crea un PIN para cada persona que dará sellos.' },
  { href: '/panel/tarjeta/poster', title: 'Imprime el póster QR', text: 'Ponlo donde tus clientes lo vean y se registren solos.' },
  { href: '/panel/caja', title: 'Da el primer sello', text: 'Genera un código en caja y pruébalo con tu propio teléfono.' }
];

/**
 * Banner "Primeros pasos". Aparece cuando la URL trae ?bienvenida=1 (la fija quien da de alta la cuenta).
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
          <h2 id="primeros-pasos-t" className="font-display text-xl font-bold tracking-tight">Primeros pasos</h2>
          <p className="mt-1 max-w-xl text-sm text-white/75">Tu negocio ya está creado. Cuatro pasos y empiezas a dar sellos hoy.</p>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold text-white/80 ring-1 ring-inset ring-white/25 hover:bg-white/10">
          Ocultar
        </button>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
