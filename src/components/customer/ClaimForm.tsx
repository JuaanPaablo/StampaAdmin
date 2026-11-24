'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { claimAction } from '@/app/u/actions';
import type { SimpleState } from './types';
import { fieldInput, linkBtn, Notice, primaryBtn, secondaryBtn } from './Shell';

/** Botón principal de la tarjeta: más alto para tocarlo fácil con el pulgar. */
const bigBtn = primaryBtn.replace('h-12', 'h-14').replace('text-base', 'text-lg');

function Submit({ children, pendingText, className = bigBtn }: { children: string; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>
      <span role="status" className="sr-only">{pending ? pendingText : ''}</span>
    </>
  );
}

/** Botón amarillo "Escribir código de caja": abre el campo de 6 dígitos y reclama el sello. */
export function ClaimForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<SimpleState, FormData>(claimAction, {});
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const autoSent = useRef('');
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);
  // Con los 6 números se suma solo (una vez por código: si falla, se corrige y se vuelve a intentar).
  useEffect(() => {
    if (open && code.length === 6 && autoSent.current !== code) {
      autoSent.current = code;
      form.current?.requestSubmit();
    }
  }, [code, open]);

  if (!open) {
    return (
      <div className="space-y-2">
        <button ref={opener} type="button" className={bigBtn} onClick={() => setOpen(true)}>Escribir código de caja</button>
        <p className="text-center text-sm text-muted">En cada compra pide tu código, o escanea el QR de caja con la cámara.</p>
      </div>
    );
  }
  const err = state.fieldErrors?.code ?? state.error;
  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="claim-code" className="block text-sm font-semibold text-navy">Código de 6 números que te dan en caja</label>
      <input
        ref={input} id="claim-code" name="code" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" enterKeyHint="go"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000" aria-invalid={!!err} aria-describedby={err ? 'claim-err' : undefined}
        className={fieldInput + ' text-center font-display text-2xl font-bold tracking-[0.4em]'}
      />
      {err && <div id="claim-err"><Notice tone="error">{err}</Notice></div>}
      <Submit pendingText="Sumando tu sello…">Sumar mi sello</Submit>
      <button type="button" className={linkBtn + ' w-full'} onClick={() => { setOpen(false); setCode(''); autoSent.current = ''; }}>Cancelar</button>
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
      {err ? (
        <Notice tone="error" title="No pudimos sumar el sello">
          {err}{/caja/i.test(err) ? '' : ' Si no se resuelve, pide ayuda en caja.'}
        </Notice>
      ) : <AutoStatus />}
      {err && <Submit pendingText="Sumando tu sello…" className={secondaryBtn}>Intentar de nuevo</Submit>}
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
