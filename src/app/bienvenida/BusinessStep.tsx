'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { Card, Input } from '@/components/ui';
import { FormField, describedBy } from '@/components/card/FormField';
import { SubmitButton } from '@/components/card/SubmitButton';
import { PlaceFields } from '@/components/shell/PlaceFields';
import type { BusinessType } from '@/lib/contracts';
import { useFocusFirstError } from '@/components/admin/useFocusFirstError';
import { saveBusinessStep, type StepState } from './actions';

export interface TypeOption { type: BusinessType; label: string }

/** Paso 1: nombre, tipo, provincia y ciudad. */
export function BusinessStep({ name, type, city, province, types }: { name: string; type: BusinessType; city: string; province: string; types: TypeOption[] }) {
  const [state, action] = useFormState<StepState, FormData>(saveBusinessStep, { ok: false });
  const [picked, setPicked] = useState<BusinessType>(type);
  const err = state.errors ?? {};
  const ref = useRef<HTMLFormElement>(null);
  useFocusFirstError(ref, state, Object.keys(err).length > 0);

  return (
    <form ref={ref} action={action} noValidate className="space-y-5">
      <Card as="section" className="space-y-5">
        <FormField id="name" label="Nombre del negocio" error={err.name}>
          <Input id="name" name="name" defaultValue={name} maxLength={80} required autoComplete="organization" placeholder="Ej. Café La Esquina"
            aria-invalid={!!err.name} aria-describedby={describedBy('name', undefined, err.name)} />
        </FormField>

        <fieldset aria-describedby={err.type ? 'type-err' : undefined}>
          <legend className="text-xs font-semibold tracking-wide text-muted">Tipo de negocio</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {types.map((t) => {
              const on = picked === t.type;
              return (
                <label key={t.type}
                  className={'relative flex min-h-[52px] cursor-pointer items-center rounded-xl px-3 py-2 ring-1 ring-inset transition focus-within:ring-2 focus-within:ring-navy ' +
                    (on ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
                  <input type="radio" name="type" value={t.type} checked={on} onChange={() => setPicked(t.type)} aria-invalid={!!err.type} className="sr-only" />
                  <span className="font-display text-sm font-semibold leading-tight">{t.label}</span>
                  {on && <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-sun" />}
                </label>
              );
            })}
          </div>
          {err.type && <p id="type-err" role="alert" className="mt-2 text-xs font-medium text-bad">{err.type}</p>}
        </fieldset>

        <PlaceFields province={province} city={city} errors={{ province: err.province, city: err.city }} />
      </Card>

      <div className="space-y-3">
        <div aria-live="polite" role="status" className="min-h-[1.25rem]">
          {state.message && !state.ok && <p className="text-sm font-medium text-bad">{state.message}</p>}
        </div>
        <SubmitButton>Guardar y seguir</SubmitButton>
      </div>
    </form>
  );
}
