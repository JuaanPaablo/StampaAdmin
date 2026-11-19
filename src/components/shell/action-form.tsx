'use client';

import { createContext, useContext, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { btnClass, inputClass } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface ActionResult { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }

const ErrorsCtx = createContext<Record<string, string>>({});

/**
 * Formulario que llama a una server action con FormData y muestra el resultado ({ ok, error, fieldErrors, message }).
 * Los campos se escriben con <FormField/>, que toma sus errores del contexto.
 */
export function ActionForm({ action, submitLabel, pendingLabel = 'Guardando…', variant = 'primary', size = 'md', className, actionsClassName, children, resetOnSuccess }: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'dark' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  className?: string;
  actionsClassName?: string;
  children?: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await action(fd);
      setRes(r);
      if (r.ok && resetOnSuccess) ref.current?.reset();
    });
  }

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className={className}>
      <ErrorsCtx.Provider value={res?.fieldErrors ?? {}}>{children}</ErrorsCtx.Provider>
      <div className={cn('flex flex-wrap items-center gap-3', actionsClassName ?? 'mt-4')}>
        <button type="submit" disabled={pending} className={btnClass(variant, size)}>{pending ? pendingLabel : submitLabel}</button>
        <p role="status" aria-live="polite" className={cn('text-sm', res?.ok ? 'text-good' : 'text-bad')}>
          {res ? (res.ok ? res.message ?? 'Listo.' : res.error ?? (res.fieldErrors ? 'Revisa los campos marcados.' : '')) : ''}
        </p>
      </div>
    </form>
  );
}

export function FormField({ name, label, hint, type = 'text', defaultValue, required, maxLength, placeholder, options, className, autoComplete }: {
  name: string; label: string; hint?: string; type?: string; defaultValue?: string; required?: boolean; maxLength?: number; placeholder?: string;
  options?: { value: string; label: string }[]; className?: string; autoComplete?: string;
}) {
  const id = useId();
  const error = useContext(ErrorsCtx)[name];
  const describedBy = error ? id + '-err' : hint ? id + '-hint' : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted">{label}</label>
      {options ? (
        <select id={id} name={name} defaultValue={defaultValue} required={required} aria-invalid={!!error} aria-describedby={describedBy} className={cn(inputClass, 'pr-8')}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input id={id} name={name} type={type} defaultValue={defaultValue} required={required} maxLength={maxLength} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={describedBy} className={inputClass} />
      )}
      {error ? <p id={id + '-err'} className="text-xs text-bad" role="alert">{error}</p> : hint ? <p id={id + '-hint'} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
