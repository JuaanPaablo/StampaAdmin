'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signOutAction } from '@/app/u/actions';
import { linkBtn } from './Shell';

function Confirm() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="inline-flex h-12 items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-white transition hover:bg-navy-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60 focus-visible:ring-offset-2 disabled:opacity-60">
      {pending ? 'Saliendo…' : 'Sí, salir'}
    </button>
  );
}

/**
 * "No soy yo / salir": borra la sesión de este teléfono. Pide confirmar antes, porque volver exige otro código por
 * correo. Los sellos no se pierden: quedan en la cuenta del correo.
 */
export function SignOut({ slug, email, stampCode }: { slug?: string; email: string; stampCode?: string }) {
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (asking) confirmRef.current?.querySelector('button')?.focus();
    else if (wasAsking.current) openRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  return (
    <form action={signOutAction} className="mt-6 text-center">
      {slug && <input type="hidden" name="slug" value={slug} />}
      {stampCode && <input type="hidden" name="c" value={stampCode} />}
      <p className="text-xs text-muted">Entraste como <span className="break-all font-semibold text-navy">{email}</span></p>
      {asking ? (
        <div ref={confirmRef} role="group" aria-labelledby="salir-titulo" className="mx-auto mt-2 max-w-sm rounded-2xl bg-white p-4 text-left ring-1 ring-line">
          <p id="salir-titulo" className="font-display text-base font-bold text-navy">¿Salir de este teléfono?</p>
          <p className="mt-0.5 text-sm text-muted">Tus sellos quedan guardados. Para volver a entrar te enviaremos un código a tu correo.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Confirm />
            <button type="button" className={linkBtn} onClick={() => setAsking(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button ref={openRef} type="button" className={linkBtn + ' mt-1 px-3'} onClick={() => setAsking(true)}>No soy yo / salir</button>
      )}
    </form>
  );
}
