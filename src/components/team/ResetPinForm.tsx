'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { resetStaffPin } from '@/app/panel/equipo/actions';
import { Card, Input } from '@/components/ui';
import { FormField, describedBy } from '@/components/card/FormField';
import { SubmitButton } from '@/components/card/SubmitButton';
import type { StaffFormState } from './schema';

export function ResetPinForm({ staffId, name, hasPin }: { staffId: string; name: string; hasPin: boolean }) {
  const [state, formAction] = useFormState<StaffFormState, FormData>(resetStaffPin, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok, state.at]);
  const err = state.errors ?? {};

  return (
    <div id="restablecer-pin" className="scroll-mt-6">
      <Card as="section" className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">{hasPin ? 'Restablecer PIN' : 'Definir PIN'}</h2>
          <p className="mt-1 text-sm text-muted">
            {hasPin ? `Define un PIN nuevo para ${name}. El anterior deja de funcionar al instante.` : `${name} aún no tiene PIN. Defínelo para que pueda aprobar cupos.`}
          </p>
        </div>
        <form ref={ref} action={formAction} className="space-y-4" noValidate autoComplete="off">
          <input type="hidden" name="id" value={staffId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="reset-pin" label="PIN nuevo (4 dígitos)" error={err.pin}>
              <Input id="reset-pin" name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required
                aria-invalid={!!err.pin} aria-describedby={describedBy('reset-pin', undefined, err.pin)} />
            </FormField>
            <FormField id="reset-pin-confirm" label="Repite el PIN nuevo" error={err.pinConfirm}>
              <Input id="reset-pin-confirm" name="pinConfirm" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required
                aria-invalid={!!err.pinConfirm} aria-describedby={describedBy('reset-pin-confirm', undefined, err.pinConfirm)} />
            </FormField>
          </div>
          <div aria-live="polite" role="status" className="min-h-[1.25rem]">
            {state.message && <p className={'text-sm font-medium ' + (state.ok ? 'text-[#12683F]' : 'text-bad')}>{state.message}</p>}
          </div>
          <SubmitButton variant="dark" pendingText="Guardando…">{hasPin ? 'Restablecer PIN' : 'Guardar PIN'}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
