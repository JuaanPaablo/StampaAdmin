'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Textarea } from '@/components/ui';
import { updateNotesAction } from '@/app/panel/clientes/actions';
import { initialFormState } from './form-state';

const MAX = 1000;

function Save({ dirty, failed }: { dirty: boolean; failed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="dark" disabled={pending || (!dirty && !failed)} aria-busy={pending}>
      {pending ? 'Guardando…' : 'Guardar notas'}
    </Button>
  );
}

export function NotesForm({ customerId, notes }: { customerId: string; notes?: string }) {
  const [state, action] = useFormState(updateNotesAction, initialFormState);
  const [value, setValue] = useState(notes ?? '');
  const [saved, setSaved] = useState(notes ?? '');
  const [submitted, setSubmitted] = useState('');
  // true si se escribió algo después del último resultado (así el "Guardado" no queda mintiendo).
  const [typedSince, setTypedSince] = useState(false);

  useEffect(() => {
    setTypedSince(false);
    if (state.ok) setSaved(submitted);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = value.trim() !== saved.trim();
  const status = typedSince ? (dirty ? 'Cambios sin guardar' : '') : state.error ?? state.message ?? '';
  const tone = typedSince ? 'text-muted' : state.error ? 'text-bad' : 'text-[#12683F]';

  return (
    <form action={action} onSubmit={() => setSubmitted(value)} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <Field label="Notas internas" htmlFor="notes" hint="Solo las ve tu equipo. Ej.: alergias, bebida favorita." error={state.fieldErrors?.notes}>
        <Textarea id="notes" name="notes" value={value} maxLength={MAX} rows={4}
          onChange={(e) => { setValue(e.target.value); setTypedSince(true); }} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Save dirty={dirty} failed={!!state.error} />
        <span role="status" aria-live="polite" className={`text-sm ${tone}`}>{status}</span>
        {value.length > MAX * 0.9 && <span className="ml-auto text-xs tabular-nums text-muted">{value.length}/{MAX}</span>}
      </div>
    </form>
  );
}
