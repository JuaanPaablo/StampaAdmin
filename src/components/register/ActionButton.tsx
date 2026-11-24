'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { flash } from './FlashRegion';
import { SubmitButton } from './SubmitButton';
import { initialActionState, type ActionState } from './types';

type Variant = 'primary' | 'dark' | 'ghost' | 'danger';

export interface ActionButtonProps {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  /** Si viene, el primer toque solo arma el botón y el segundo confirma (sin confirm() del navegador). */
  confirmLabel?: string;
  confirmQuestion?: string;
  variant?: Variant;
  size?: 'md' | 'sm';
  pendingText?: string;
  className?: string;
  /** Muestra el mensaje de éxito junto al botón. */
  showSuccess?: boolean;
  /**
   * Envía el mensaje de éxito a <FlashRegion />. Úsalo cuando la fila desaparece tras la acción
   * (p. ej. un canje): el botón se desmonta y su propio mensaje no se alcanzaría a ver.
   */
  broadcast?: boolean;
}

// Objetivo táctil mínimo de 44 px aunque el botón sea "sm".
const TOUCH = 'min-h-11';

export function ActionButton({ action, fields, label, confirmLabel, confirmQuestion, variant = 'primary', size = 'md', pendingText, className, showSuccess = true, broadcast = false }: ActionButtonProps) {
  const [armed, setArmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const armRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  const run = useCallback(async (prev: ActionState, fd: FormData): Promise<ActionState> => {
    const r = await action(prev, fd);
    setArmed(false);
    if (broadcast && r.ok && r.message) flash(r.message);
    return r;
  }, [action, broadcast]);
  const [state, formAction] = useFormState<ActionState, FormData>(run, initialActionState);

  // Se desarma solo a los 6 s para que un toque olvidado no quede listo para confirmar.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => {
      returnFocus.current = !!formRef.current?.contains(document.activeElement);
      setArmed(false);
    }, 6000);
    return () => clearTimeout(t);
  }, [armed]);

  // Al armar, el foco pasa al botón de confirmar; al desarmar, vuelve al botón original.
  useEffect(() => {
    if (armed) {
      formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      armRef.current?.focus();
    }
  }, [armed]);

  const needsConfirm = !!confirmLabel;
  const hidden = Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <form ref={formRef} action={formAction} className={cn('flex flex-col items-start gap-1.5', className)}
      onKeyDown={(e) => { if (armed && e.key === 'Escape') { returnFocus.current = true; setArmed(false); } }}>
      {hidden}
      {needsConfirm && !armed ? (
        <button ref={armRef} type="button" onClick={() => setArmed(true)} className={cn(btnClass(variant, size), TOUCH)}>{label}</button>
      ) : (
        <>
          {armed && confirmQuestion && <p className="text-xs font-medium text-navy">{confirmQuestion}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton variant={needsConfirm ? 'dark' : variant} size={size} pendingText={pendingText} className={TOUCH}>{needsConfirm ? confirmLabel : label}</SubmitButton>
            {needsConfirm && (
              <button type="button" onClick={() => { returnFocus.current = true; setArmed(false); }}
                className={cn('rounded-full px-4 text-[13px] font-semibold text-muted hover:bg-surface hover:text-navy', TOUCH)}>
                No, volver
              </button>
            )}
          </div>
        </>
      )}
      <div aria-live="polite" role="status" className="text-xs">
        {state.error && <p className="font-medium text-bad">{state.error}</p>}
        {showSuccess && !broadcast && state.ok && state.message && <p className="font-medium text-[#12683F]">{state.message}</p>}
      </div>
    </form>
  );
}
