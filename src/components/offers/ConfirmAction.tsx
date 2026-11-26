'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { newRequestId } from '@/lib/request-id';

/** `query` (opcional) se agrega a onSuccessHref, p. ej. 'enviado=10.4' para que la página muestre el resultado. */
export interface ConfirmResult { ok: boolean; error?: string; message?: string; query?: string }

/**
 * Acción en dos pasos (como Eliminar sucursal): un botón abre una confirmación con lo que va a pasar y recién ahí se
 * ejecuta la server action. Evita acciones por un toque accidental en el celular. Escape cancela.
 * `fields` se envían como FormData. Si `onSuccessHref` existe, al terminar bien navega ahí; si no, refresca la página.
 */
export function ConfirmAction({ action, fields, label, title, children, confirmLabel, pendingLabel = 'Un momento…', tone = 'danger', onSuccessHref, openVariant, idempotent }: {
  action: (fd: FormData) => Promise<ConfirmResult>;
  fields: Record<string, string>;
  label: string;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: 'danger' | 'primary';
  onSuccessHref?: string;
  openVariant?: 'primary' | 'dark' | 'ghost' | 'danger';
  /** Manda un `requestId` nuevo cada vez que se abre la confirmación (operaciones con dinero, ej. anular gift card). */
  idempotent?: boolean;
}) {
  const router = useRouter();
  const uid = useId();
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  const requestId = useRef('');

  useEffect(() => {
    if (asking) cancelRef.current?.focus();
    else if (wasAsking.current) openRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  function confirm() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    if (idempotent) fd.set('requestId', requestId.current || (requestId.current = newRequestId()));
    start(async () => {
      const r = await action(fd);
      if (!r.ok) { setMsg({ ok: false, text: r.error ?? 'No pudimos completar la acción. Inténtalo de nuevo.' }); return; }
      setAsking(false);
      setMsg({ ok: true, text: r.message ?? 'Listo.' });
      if (onSuccessHref) router.push(r.query ? `${onSuccessHref}${onSuccessHref.includes('?') ? '&' : '?'}${r.query}` : onSuccessHref);
      else router.refresh();
    });
  }

  if (!asking) {
    return (
      <div className="flex flex-col gap-2">
        <button ref={openRef} type="button" onClick={() => { setMsg(null); requestId.current = newRequestId(); setAsking(true); }} className={cn(btnClass(openVariant ?? (tone === 'danger' ? 'danger' : 'primary')), 'self-start')}>
          {label}
        </button>
        <p role="status" aria-live="polite" className={cn('text-sm empty:hidden', msg?.ok ? 'text-good' : 'text-bad')}>{msg?.text ?? ''}</p>
      </div>
    );
  }

  const danger = tone === 'danger';
  return (
    <div role="alertdialog" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}
      className={cn('w-full rounded-xl p-4', danger ? 'bg-[#FBE0DE] text-[#9B2A22]' : 'bg-[#FFF4CC] text-navy')}
      onKeyDown={(e) => { if (e.key === 'Escape' && !pending) setAsking(false); }}>
      <p id={`${uid}-t`} className="font-semibold">{title}</p>
      <div id={`${uid}-d`} className="mt-1 space-y-1 text-sm">{children}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={pending} aria-busy={pending}
          className={danger
            ? 'inline-flex h-11 items-center justify-center rounded-full bg-[#9B2A22] px-5 text-sm font-semibold text-white transition hover:bg-[#7F2019] disabled:opacity-50'
            : btnClass('dark')}>
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button ref={cancelRef} type="button" onClick={() => setAsking(false)} disabled={pending} className={btnClass('ghost')}>Cancelar</button>
      </div>
      <p role="alert" className="mt-2 text-sm font-medium empty:hidden">{msg && !msg.ok ? msg.text : ''}</p>
    </div>
  );
}
