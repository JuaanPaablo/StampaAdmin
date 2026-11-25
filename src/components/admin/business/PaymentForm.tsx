'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { btnClass, inputClass } from '@/components/ui';
import { recordPaymentAction, type PaymentFormState } from '@/lib/admin-actions';
import type { PaymentMethod } from '@/lib/contracts';
import {
  MAX_PAYMENT_MONTHS, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, ecDateLabel, ecDayKey, isDayKey, nextPlanExpiry
} from '@/lib/domain/admin-insights';
import { cn } from '@/lib/cn';
import { useFocusFirstError } from '../useFocusFirstError';

const label = 'text-xs font-semibold tracking-wide text-muted';
const MONTH_OPTIONS = Array.from({ length: MAX_PAYMENT_MONTHS }, (_, i) => i + 1);

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={btnClass('primary') + ' h-12 w-full sm:w-auto'}>
      {pending ? 'Registrando…' : 'Registrar pago'}
    </button>
  );
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="text-xs text-bad" aria-live="polite">{text}</p> : null;
}

/**
 * "Registrar pago": monto (precio del plan), fecha (hoy en Ecuador), forma de pago y hasta cuándo queda vigente
 * (sumar meses o elegir la fecha). Muestra en vivo el nuevo vencimiento con la misma regla del servidor (nextPlanExpiry).
 * El servidor vuelve a validar todo.
 */
export function PaymentForm({ businessId, defaultAmount, currentExpiresAt }: {
  businessId: string; defaultAmount: string; currentExpiresAt?: string;
}) {
  const [state, action] = useFormState<PaymentFormState, FormData>(recordPaymentAction, { status: 'idle' });
  // Tras un pago correcto el formulario se vuelve a montar con los valores por defecto (y el vencimiento ya actualizado).
  const formKey = state.status === 'ok' ? state.payment.id : 'nuevo';
  return (
    <div className="flex flex-col gap-4">
      {state.status === 'ok' && (
        <p role="status" className="rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-semibold text-[#12683F]">
          {state.message} El plan vence el {ecDateLabel(state.newExpiresAt)}.
        </p>
      )}
      <PaymentFields key={formKey} action={action} state={state} businessId={businessId} defaultAmount={defaultAmount} currentExpiresAt={currentExpiresAt} />
    </div>
  );
}

function PaymentFields({ action, state, businessId, defaultAmount, currentExpiresAt }: {
  action: (fd: FormData) => void; state: PaymentFormState; businessId: string; defaultAmount: string; currentExpiresAt?: string;
}) {
  const today = ecDayKey(Date.now());
  const [amount, setAmount] = useState(defaultAmount);
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('transferencia');
  const [mode, setMode] = useState<'months' | 'date'>('months');
  const [months, setMonths] = useState(1);
  const [newExpires, setNewExpires] = useState('');
  const [note, setNote] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.status === 'error' ? state.fieldErrors ?? {} : {};
  useFocusFirstError(formRef, state, Object.keys(fe).length > 0);

  // Vista previa del nuevo vencimiento (misma regla que el servidor).
  let preview: string | null = null;
  let basis = '';
  if (mode === 'months' && isDayKey(paidAt)) {
    preview = nextPlanExpiry({ currentExpiresAt, paidAt, months }).expiresAt;
    const currentDay = currentExpiresAt ? ecDayKey(currentExpiresAt) : null;
    basis = currentDay && currentDay > paidAt
      ? `Se suma desde el vencimiento actual (${ecDateLabel(currentExpiresAt!)}).`
      : 'Se suma desde la fecha del pago.';
  } else if (mode === 'date' && isDayKey(newExpires)) {
    preview = nextPlanExpiry({ paidAt, newExpiresAt: newExpires }).expiresAt;
  }
  const tomorrow = ecDayKey(Date.now() + 86_400_000);
  const describe = (name: string, hint?: string) => (fe[name] ? `${name}-err` : hint);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-amount" className={label}>Monto (USD)</label>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted">$</span>
            <input id="pay-amount" name="amount" type="text" inputMode="decimal" autoComplete="off" required maxLength={12}
              value={amount} onChange={(e) => setAmount(e.currentTarget.value)}
              aria-invalid={!!fe.amount} aria-describedby={describe('amount', 'amount-hint')}
              className={cn(inputClass, 'h-12 pl-7', fe.amount && 'border-bad')} />
          </div>
          {fe.amount ? <FieldError id="amount-err" text={fe.amount} /> : <p id="amount-hint" className="text-xs text-muted">Con coma: 54,99</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-date" className={label}>Fecha del pago</label>
          <input id="pay-date" name="paidAt" type="date" required max={today} min="2020-01-01"
            value={paidAt} onChange={(e) => setPaidAt(e.currentTarget.value)}
            aria-invalid={!!fe.paidAt} aria-describedby={describe('paidAt')}
            className={cn(inputClass, 'h-12', fe.paidAt && 'border-bad')} />
          <FieldError id="paidAt-err" text={fe.paidAt} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-method" className={label}>Forma de pago</label>
          <select id="pay-method" name="method" value={method} onChange={(e) => setMethod(e.currentTarget.value as PaymentMethod)}
            aria-invalid={!!fe.method} aria-describedby={describe('method')}
            className={cn(inputClass, 'h-12 pr-8', fe.method && 'border-bad')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
          </select>
          <FieldError id="method-err" text={fe.method} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl bg-surface p-4">
        <legend className="float-left mb-1 w-full text-sm font-semibold text-navy">¿Hasta cuándo queda pagado?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([['months', 'Sumar meses'], ['date', 'Elegir la fecha']] as const).map(([value, text]) => (
            <label key={value} className={cn('flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-white px-4 text-sm font-semibold text-navy ring-1 ring-inset focus-within:ring-2 focus-within:ring-navy',
              mode === value ? 'ring-navy' : 'ring-[#C9D6E3]')}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="h-5 w-5 accent-[#001D3D]" />
              {text}
            </label>
          ))}
        </div>
        {mode === 'months' ? (
          <div className="flex flex-col gap-1.5 sm:max-w-[16rem]">
            <label htmlFor="pay-months" className={label}>Meses que paga</label>
            <select id="pay-months" name="months" value={months} onChange={(e) => setMonths(Number(e.currentTarget.value))}
              aria-invalid={!!fe.months} aria-describedby={describe('months')}
              className={cn(inputClass, 'h-12 pr-8', fe.months && 'border-bad')}>
              {MONTH_OPTIONS.map((n) => <option key={n} value={n}>{n} {n === 1 ? 'mes' : 'meses'}</option>)}
            </select>
            <FieldError id="months-err" text={fe.months} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:max-w-[16rem]">
            <label htmlFor="pay-newexp" className={label}>Nuevo vencimiento</label>
            <input id="pay-newexp" name="newExpires" type="date" required min={tomorrow}
              value={newExpires} onChange={(e) => setNewExpires(e.currentTarget.value)}
              aria-invalid={!!fe.newExpiresAt} aria-describedby={describe('newExpiresAt')}
              className={cn(inputClass, 'h-12', fe.newExpiresAt && 'border-bad')} />
            <FieldError id="newExpiresAt-err" text={fe.newExpiresAt} />
          </div>
        )}
        <p aria-live="polite" className="text-sm text-navy">
          {preview
            ? <>El plan quedará vigente hasta el <strong className="font-semibold">{ecDateLabel(preview)}</strong>.{basis && <span className="text-muted"> {basis}</span>}</>
            : <span className="text-muted">{mode === 'date' ? 'Elige la fecha para ver el nuevo vencimiento.' : 'Elige la fecha del pago para ver el nuevo vencimiento.'}</span>}
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pay-note" className={label}>Nota (opcional)</label>
        <textarea id="pay-note" name="note" maxLength={500} value={note} onChange={(e) => setNote(e.currentTarget.value)}
          placeholder="Número de comprobante, banco…" aria-invalid={!!fe.note} aria-describedby={describe('note')}
          className={cn(inputClass, 'h-auto min-h-20 py-2.5', fe.note && 'border-bad')} />
        <FieldError id="note-err" text={fe.note} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Submit />
        {state.status === 'error' && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      </div>
    </form>
  );
}
