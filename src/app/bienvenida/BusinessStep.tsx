'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Card, Input } from '@/components/ui';
import { FormField, describedBy } from '@/components/card/FormField';
import { SubmitButton } from '@/components/card/SubmitButton';
import type { BusinessType } from '@/lib/contracts';
import { saveBusinessStep, type StepState } from './actions';

export interface TypeOption { type: BusinessType; label: string; tagline: string }

/** Paso 1: nombre, tipo (tarjetas visuales) y ciudad. */
export function BusinessStep({ name, type, city, types }: { name: string; type: BusinessType; city: string; types: TypeOption[] }) {
  const [state, action] = useFormState<StepState, FormData>(saveBusinessStep, { ok: false });
  const [picked, setPicked] = useState<BusinessType>(type);
  const err = state.errors ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      <Card as="section" className="space-y-5">
        <FormField id="name" label="Nombre de tu negocio" error={err.name} help="Así lo verán tus clientes en su tarjeta y en tu póster.">
          <Input id="name" name="name" defaultValue={name} maxLength={80} required autoComplete="organization" placeholder="Ej. Café La Esquina"
            aria-invalid={!!err.name} aria-describedby={describedBy('name', 'x', err.name)} />
        </FormField>

        <fieldset aria-describedby={err.type ? 'type-err' : undefined}>
          <legend className="text-xs font-semibold tracking-wide text-muted">¿Qué tipo de negocio es?</legend>
          <p className="mt-1 text-xs text-muted">Con esto preparamos tu tarjeta y las palabras del panel. Lo puedes cambiar después.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {types.map((t) => {
              const on = picked === t.type;
              return (
                <label key={t.type}
                  className={'relative flex min-h-[76px] cursor-pointer flex-col justify-center rounded-xl p-3 ring-1 ring-inset transition focus-within:ring-2 focus-within:ring-navy ' +
                    (on ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
                  <input type="radio" name="type" value={t.type} checked={on} onChange={() => setPicked(t.type)} className="sr-only" />
                  <span className="font-display text-sm font-semibold leading-tight">{t.label}</span>
                  <span className={'mt-1 text-[11px] leading-snug ' + (on ? 'text-white/75' : 'text-muted')}>{t.tagline}</span>
                  {on && <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-sun" />}
                </label>
              );
            })}
          </div>
          {err.type && <p id="type-err" role="alert" className="mt-2 text-xs font-medium text-bad">{err.type}</p>}
        </fieldset>

        <FormField id="city" label="Ciudad" optional error={err.city} className="max-w-sm">
          <Input id="city" name="city" defaultValue={city} maxLength={60} autoComplete="address-level2" placeholder="Ej. Guayaquil"
            aria-invalid={!!err.city} aria-describedby={describedBy('city', undefined, err.city)} />
        </FormField>
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
