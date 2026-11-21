'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

export const authField = 'h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-base text-navy placeholder:text-[#5A6F86] focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50';
export const authLabel = 'text-sm font-semibold text-navy';

/** Campo de contraseña con "Mostrar / Ocultar" y su mensaje de error o ayuda. */
export function PasswordInput({ id, name, label, autoComplete, error, hint, autoFocus, minLength }: {
  id: string; name: string; label: string; autoComplete: 'new-password' | 'current-password'; error?: string; hint?: string; autoFocus?: boolean; minLength?: number;
}) {
  const [show, setShow] = useState(false);
  const described = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={authLabel}>{label}</label>
      <div className="relative">
        <input
          id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} required autoFocus={autoFocus}
          minLength={minLength} maxLength={200} aria-invalid={!!error} aria-describedby={described}
          className={cn(authField, 'pr-24', error ? 'border-bad' : 'border-[#B7C6D6]')}
        />
        <button
          type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-controls={id}
          className="absolute right-1.5 top-1/2 h-10 -translate-y-1/2 rounded-lg px-3 text-[13px] font-semibold text-navy hover:bg-surface"
        >
          {show ? 'Ocultar' : 'Mostrar'}<span className="sr-only"> contraseña</span>
        </button>
      </div>
      {error ? <p id={`${id}-err`} role="alert" className="text-[13px] text-bad">{error}</p> : hint ? <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit" disabled={pending} aria-busy={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sun text-[15px] font-semibold text-navy transition hover:bg-sun-2 active:scale-[.99] disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy motion-reduce:animate-none" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
