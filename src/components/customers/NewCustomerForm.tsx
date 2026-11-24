'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { createCustomerAction } from '@/app/panel/clientes/actions';
import { initialFormState } from './form-state';
import { MONTHS_FULL } from '@/components/dashboard/helpers';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Orden en que se enfoca el primer campo con error. */
const FIELD_ORDER: [string, string][] = [['name', 'nc-name'], ['contact', 'nc-contact'], ['birthday', 'nc-day'], ['consent', 'nc-consent']];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Guardando…' : label}</Button>;
}

/** Botón y formulario para registrar a mano a un cliente nuevo. Al guardar, lleva a su ficha. */
export function NewCustomerForm({ customerLabel }: { customerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'whatsapp' | 'email'>('whatsapp');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [state, action] = useFormState(createCustomerAction, initialFormState);
  const fe = state.fieldErrors ?? {};
  const days = month === '' ? 31 : DAYS_IN_MONTH[Number(month)] ?? 31;

  // Al abrir, el cursor va al nombre para empezar a escribir de una. (Los componentes de ui no reenvían ref.)
  useEffect(() => { if (open) document.getElementById('nc-name')?.focus(); }, [open]);
  // Tras un error, lleva el foco al primer campo que hay que corregir.
  useEffect(() => {
    if (!state.fieldErrors) return;
    const first = FIELD_ORDER.find(([k]) => state.fieldErrors?.[k]);
    if (first) document.getElementById(first[1])?.focus();
  }, [state]);

  function close() {
    setOpen(false);
    document.getElementById('nc-toggle')?.focus();
  }

  return (
    <div>
      <Button id="nc-toggle" type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-controls="nuevo-cliente"
        variant={open ? 'ghost' : 'primary'}>
        {open ? 'Cerrar formulario' : `Nuevo ${customerLabel}`}
      </Button>
      {open && (
        <Card as="div" className="mt-4 max-w-2xl">
          <form id="nuevo-cliente" action={action} className="grid gap-4 sm:grid-cols-2" noValidate
            onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
            <h2 className="font-display text-lg font-semibold text-navy sm:col-span-2">Registrar {customerLabel}</h2>
            {state.error && <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3 py-2 text-sm text-[#9B2A22] sm:col-span-2">{state.error}</p>}
            <div className="sm:col-span-2">
              <Field label="Nombre completo" htmlFor="nc-name" error={fe.name}>
                <Input id="nc-name" name="name" required autoComplete="off" autoCapitalize="words" maxLength={80} aria-invalid={!!fe.name} />
              </Field>
            </div>
            <Field label="Tipo de contacto" htmlFor="nc-kind">
              <Select id="nc-kind" name="contactKind" value={kind} onChange={(e) => setKind(e.target.value as 'whatsapp' | 'email')}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Correo electrónico</option>
              </Select>
            </Field>
            <Field label={kind === 'whatsapp' ? 'Número de WhatsApp' : 'Correo electrónico'} htmlFor="nc-contact" error={fe.contact}
              hint={kind === 'whatsapp' ? 'Ejemplo: 0991234567' : 'Ejemplo: nombre@correo.com'}>
              <Input id="nc-contact" name="contact" required aria-invalid={!!fe.contact} maxLength={120}
                type={kind === 'email' ? 'email' : 'tel'} inputMode={kind === 'email' ? 'email' : 'tel'} autoComplete="off" />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted">Cumpleaños (opcional)</legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Día" htmlFor="nc-day">
                  <Select id="nc-day" name="day" value={day} onChange={(e) => setDay(e.target.value)} aria-invalid={!!fe.birthday}>
                    <option value="">—</option>
                    {Array.from({ length: days }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </Select>
                </Field>
                <Field label="Mes" htmlFor="nc-month">
                  <Select id="nc-month" name="month" value={month} aria-invalid={!!fe.birthday}
                    onChange={(e) => {
                      const m = e.target.value;
                      setMonth(m);
                      // Si el día ya no existe en el mes elegido (31 de abril), se limpia en vez de fallar al guardar.
                      if (m !== '' && Number(day) > DAYS_IN_MONTH[Number(m)]) setDay('');
                    }}>
                    <option value="">—</option>
                    {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </Select>
                </Field>
              </div>
              {fe.birthday && <p className="mt-1 text-xs text-bad" role="alert">{fe.birthday}</p>}
            </fieldset>
            <div className="sm:col-span-2">
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-navy" htmlFor="nc-consent">
                <input id="nc-consent" name="consent" type="checkbox" required aria-invalid={!!fe.consent}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#C9D6E3] accent-navy" />
                <span>Esta persona aceptó recibir mensajes sobre su tarjeta y premios, y puede pedir que la borremos cuando quiera.</span>
              </label>
              {fe.consent && <p className="mt-1 text-xs text-bad" role="alert">{fe.consent}</p>}
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Submit label={`Guardar ${customerLabel}`} />
              <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
