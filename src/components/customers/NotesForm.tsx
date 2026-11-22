'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Textarea } from '@/components/ui';
import { updateNotesAction } from '@/app/panel/clientes/actions';
import { initialFormState } from './form-state';

function Save() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant="dark" disabled={pending}>{pending ? 'Guardando…' : 'Guardar notas'}</Button>;
}

export function NotesForm({ customerId, notes }: { customerId: string; notes?: string }) {
  const [state, action] = useFormState(updateNotesAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <Field label="Notas internas" htmlFor="notes" hint="Solo las ve tu equipo." error={state.fieldErrors?.notes}>
        <Textarea id="notes" name="notes" defaultValue={notes ?? ''} maxLength={1000} rows={4} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Save />
        <span role="status" aria-live="polite" className={state.error ? 'text-sm text-bad' : 'text-sm text-[#12683F]'}>
          {state.error ?? state.message ?? ''}
        </span>
      </div>
    </form>
  );
}
