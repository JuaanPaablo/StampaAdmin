'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';
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
}

export function ActionButton({ action, fields, label, confirmLabel, confirmQuestion, variant = 'primary', size = 'md', pendingText, className, showSuccess = true }: ActionButtonProps) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, initialActionState);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);

  const needsConfirm = !!confirmLabel;
  const hidden = Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <form action={formAction} className={cn('flex flex-col items-start gap-1.5', className)}>
      {hidden}
      {needsConfirm && !armed ? (
        <button type="button" onClick={() => setArmed(true)} className={btnClass(variant, size)}>{label}</button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton variant={needsConfirm ? 'dark' : variant} size={size} pendingText={pendingText}>{needsConfirm ? confirmLabel : label}</SubmitButton>
          {needsConfirm && (
            <button type="button" onClick={() => setArmed(false)} className="h-9 rounded-full px-3 text-[13px] font-semibold text-muted hover:text-navy">
              No, volver
            </button>
          )}
        </div>
      )}
      {armed && confirmQuestion && <p className="text-xs text-muted">{confirmQuestion}</p>}
      <div aria-live="polite" role="status" className="text-xs">
        {state.error && <p className="font-medium text-bad">{state.error}</p>}
        {showSuccess && state.ok && state.message && <p className="font-medium text-[#12683F]">{state.message}</p>}
      </div>
    </form>
  );
}
