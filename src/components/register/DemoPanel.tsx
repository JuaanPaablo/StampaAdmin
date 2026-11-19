'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Badge, Field, Select } from '@/components/ui';
import { simulateResendAction, simulateScanAction } from '@/app/panel/caja/actions';
import { SubmitButton } from './SubmitButton';
import { initialActionState, type ActionState } from './types';

export interface DemoCustomer { id: string; name: string }

function Result({ state, neutral }: { state: ActionState; neutral?: boolean }) {
  return (
    <div aria-live="polite" role="status" className="min-h-5 text-sm">
      {state.error && <p className="font-medium text-bad">{state.error}</p>}
      {state.message && <p className={neutral ? 'font-medium text-[#7A5A00]' : 'font-medium text-[#12683F]'}>{state.message}</p>}
    </div>
  );
}

/** Herramientas de demostración: reemplazan al teléfono del cliente. No existen en producción. */
export function DemoPanel({ codeId, customers, vocab, burned }: { codeId: string; customers: DemoCustomer[]; vocab: { customer: string; customers: string }; burned: boolean }) {
  const [scan, scanAction] = useFormState<ActionState, FormData>(simulateScanAction, initialActionState);
  const [resend, resendAction] = useFormState<ActionState, FormData>(simulateResendAction, initialActionState);
  const [customerId, setCustomerId] = useState('');

  return (
    <details className="group rounded-2xl bg-white shadow-card ring-1 ring-dashed ring-[#C9D6E3]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="font-display text-base font-semibold text-navy">Probar en la demo</span>
          <Badge tone="info">Demostración</Badge>
        </span>
        <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <div className="flex flex-col gap-6 border-t border-line px-5 pb-5 pt-4">
        <p className="text-sm text-muted">
          Esto simula lo que haría el teléfono de cada {vocab.customer}. En el mostrador real no aparece: los {vocab.customers} escanean el QR o digitan el código.
        </p>

        <form action={scanAction} className="flex flex-col gap-3">
          <input type="hidden" name="codeId" value={codeId} />
          <Field label={'Elegir ' + vocab.customer + ' que escanea'} htmlFor="demo-customer">
            <Select id="demo-customer" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Selecciona…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton variant="dark" pendingText="Escaneando…">Simular escaneo</SubmitButton>
          </div>
          <Result state={scan} />
        </form>

        <form action={resendAction} className="flex flex-col gap-3 border-t border-line pt-5">
          <input type="hidden" name="codeId" value={codeId} />
          <p className="text-sm text-muted">
            {burned
              ? 'El código ya está quemado: un tercero lo intenta con la captura que le reenviaron.'
              : 'Un ' + vocab.customer + ' que ya reclamó le reenvía el código a alguien. Con el segundo intento se ve el rechazo.'}
          </p>
          <div><SubmitButton variant="ghost" pendingText="Reenviando…">Simular reenvío por WhatsApp</SubmitButton></div>
          <Result state={resend} neutral />
        </form>
      </div>
    </details>
  );
}
