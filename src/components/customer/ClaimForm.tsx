'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { claimAction } from '@/app/u/actions';
import type { SimpleState } from './types';
import { fieldInput, linkBtn, Notice, primaryBtn } from './Shell';

/** Botón principal de la tarjeta: más alto para tocarlo fácil con el pulgar. */
const bigBtn = primaryBtn.replace('h-12', 'h-14').replace('text-base', 'text-lg');

function Submit({ children, pendingText }: { children: string; pendingText: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={bigBtn} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>;
}

/** Botón amarillo "Escribir código": abre el campo de 6 dígitos y reclama el sello. */
export function ClaimForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<SimpleState, FormData>(claimAction, {});
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (!open) {
    return <button type="button" className={bigBtn} onClick={() => setOpen(true)}>Escribir código</button>;
  }
  const err = state.fieldErrors?.code ?? state.error;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="claim-code" className="block text-sm font-semibold text-navy">Código de caja</label>
      <input
        ref={input} id="claim-code" name="code" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000" aria-invalid={!!err} aria-describedby={err ? 'claim-err' : undefined}
        className={fieldInput + ' text-center font-display text-2xl font-bold tracking-[0.4em]'}
      />
      {err && <div id="claim-err"><Notice tone="error">{err}</Notice></div>}
      <Submit pendingText="Sumando tu sello…">Sumar mi sello</Submit>
      <button type="button" className={linkBtn + ' w-full'} onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  );
}

/**
 * Reclamo desde el QR de caja: envía el formulario UNA sola vez al cargar (la server action redirige a la tarjeta, así
 * que recargar esa página no vuelve a reclamar). Si algo falla muestra el error y un botón para reintentar.
 */
export function AutoClaim({ slug, code }: { slug: string; code: string }) {
  const [state, action] = useFormState<SimpleState, FormData>(claimAction, {});
  const form = useRef<HTMLFormElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    form.current?.requestSubmit();
  }, []);
  const err = state.fieldErrors?.code ?? state.error;
  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="code" value={code} />
      <p className="text-center text-sm text-muted">Código <span className="font-display font-bold tracking-widest text-navy">{code}</span></p>
      {err ? <Notice tone="error">{err}</Notice> : <AutoStatus />}
      {err && <Submit pendingText="Sumando tu sello…">Intentar de nuevo</Submit>}
    </form>
  );
}

function AutoStatus() {
  const { pending } = useFormStatus();
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-navy">
      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent motion-reduce:animate-none" />
      {pending ? 'Sumando tu sello…' : 'Preparando tu sello…'}
    </div>
  );
}
