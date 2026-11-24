'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { passwordHint } from './password-hint';

export const authField = 'h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-base text-navy placeholder:text-[#5A6F86] focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50';
export const authLabel = 'text-sm font-semibold text-navy';
const NONE = Symbol('none');

/**
 * Campo de contraseña con "Mostrar / Ocultar", aviso de Bloq Mayús y su mensaje de error o ayuda.
 * - `minLength`: muestra el requisito mientras escribe ("Mínimo 10 caracteres · faltan 4" → "✓ 10 caracteres o más").
 * - `matchValue`: campo "Repite la contraseña"; dice si coincide mientras escribe.
 * - Un error del servidor se oculta en cuanto la persona vuelve a escribir en ese campo (`errorKey` cambia con cada envío).
 */
export function PasswordInput({ id, name, label, autoComplete, error, hint, autoFocus, minLength, matchValue, onValueChange, errorKey }: {
  id: string; name: string; label: string; autoComplete: 'new-password' | 'current-password'; error?: string; hint?: string; autoFocus?: boolean; minLength?: number;
  matchValue?: string; onValueChange?: (v: string) => void; errorKey?: unknown;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  const [caps, setCaps] = useState(false);
  // Respuesta del servidor en la que la persona ya volvió a escribir: su error se oculta. Un envío nuevo lo vuelve a mostrar.
  const [typedAt, setTypedAt] = useState<unknown>(NONE);
  const ref = useRef<HTMLInputElement>(null);
  const errorTag = errorKey ?? error;

  // form.reset() no dispara onChange: limpia el estado de la ayuda en vivo.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => { setValue(''); onValueChange?.(''); };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [onValueChange]);

  const live = passwordHint(value, minLength, matchValue);
  const showError = !!error && typedAt !== errorTag;
  const helpText = live ?? (hint ? { ok: false, text: hint } : null);
  const described = [showError ? `${id}-err` : helpText ? `${id}-hint` : null, caps ? `${id}-caps` : null].filter(Boolean).join(' ') || undefined;
  const keyCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={authLabel}>{label}</label>
      <div className="relative">
        <input
          ref={ref} id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} required autoFocus={autoFocus}
          minLength={minLength} maxLength={200} aria-invalid={showError} aria-describedby={described}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className={cn(authField, 'pr-24', showError ? 'border-bad' : 'border-[#B7C6D6]')}
          onChange={(e) => { setValue(e.target.value); onValueChange?.(e.target.value); if (error) setTypedAt(errorTag); }}
          onKeyDown={keyCaps} onKeyUp={keyCaps} onBlur={() => setCaps(false)}
        />
        <button
          type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-controls={id}
          className="absolute right-1 top-1/2 h-11 -translate-y-1/2 rounded-lg px-3 text-[13px] font-semibold text-navy hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          {show ? 'Ocultar' : 'Mostrar'}<span className="sr-only"> contraseña</span>
        </button>
      </div>
      {showError ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] text-bad">{error}</p>
      ) : helpText ? (
        <p id={`${id}-hint`} aria-live={live ? 'polite' : undefined} className={cn('flex items-center gap-1.5 text-[13px]', helpText.ok ? 'font-medium text-[#12683F]' : 'text-muted')}>
          {helpText.ok && <Check />}
          {helpText.text}
          {'extra' in helpText && helpText.extra && <span aria-hidden="true">{helpText.extra}</span>}
        </p>
      ) : null}
      {caps && <p id={`${id}-caps`} className="text-[13px] font-medium text-[#7A5A00]">Bloq Mayús está activado.</p>}
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit" disabled={pending} aria-busy={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sun text-[15px] font-semibold text-navy transition hover:bg-sun-2 active:scale-[.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/40 disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy motion-reduce:animate-none" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
