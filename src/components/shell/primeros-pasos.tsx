'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const STEPS = [
  { href: '/panel/tarjeta/poster', title: 'Descarga tu póster QR', text: 'Imprímelo y ponlo donde tus clientes lo vean. Lo escanean y crean su tarjeta.' },
  { href: '/panel/equipo', title: 'Invita a tu equipo', text: 'Agrega a quien atiende y envíale su invitación por correo.' },
  { href: '/panel/caja', title: 'Da el primer sello', text: 'Genera un código en caja y pruébalo con tu propio teléfono.' }
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
          <p className="mt-1 max-w-xl text-sm text-white/75">Tu tarjeta de sellos está lista. Descarga tu póster QR y empieza a dar sellos hoy.</p>
          <Link href="/panel/tarjeta/poster" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-sun px-5 text-sm font-semibold text-navy hover:bg-sun-2">Descargar mi póster QR</Link>
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
