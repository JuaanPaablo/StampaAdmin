'use client';

import type { ReactNode } from 'react';
import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/card/SubmitButton';
import { completeSetupAction, type StepState } from './actions';

/** Paso 5: botón "Abrir mi panel" (activa el negocio). */
export function CompleteStep({ back }: { back: ReactNode }) {
  const [state, action] = useFormState<StepState, FormData>(completeSetupAction, { ok: false });
  return (
    <form action={action} className="space-y-3">
      <div aria-live="polite" role="status" className="min-h-[1.25rem]">
        {state.message && !state.ok && <p className="text-sm font-medium text-bad">{state.message}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Abriendo…" className="h-12 px-6 text-base">Abrir mi panel</SubmitButton>
        {back}
      </div>
    </form>
  );
}
