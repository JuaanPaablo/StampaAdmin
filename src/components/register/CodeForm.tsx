'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Field, Input } from '@/components/ui';
import { maxSeats, needsApproval } from '@/lib/domain';
import { money, parseMoney } from '@/lib/format';
import type { Program } from '@/lib/contracts';
import { createCodeAction } from '@/app/panel/caja/actions';
import { SubmitButton } from './SubmitButton';
import type { CodeFormState } from './types';

type ProgramRules = Pick<Program, 'requireAmount' | 'minSpendCentsPerStamp' | 'maxSeatsWithoutApproval'>;

const ABSOLUTE_MAX = 50;

export interface CodeFormProps {
  program: ProgramRules;
  vocab: { ticket: string; people: string; customers: string };
}

export function CodeForm({ program, vocab }: CodeFormProps) {
  const [state, formAction] = useFormState<CodeFormState, FormData>(createCodeAction, {});
  const [ticket, setTicket] = useState('');
  const [amount, setAmount] = useState('');
  const [seats, setSeats] = useState(1);
  const [pin, setPin] = useState('');

  const cents = program.requireAmount ? parseMoney(amount) : 0;
  const limit = program.requireAmount ? (cents > 0 ? Math.min(ABSOLUTE_MAX, Math.max(0, maxSeats(cents, program))) : 0) : Math.min(ABSOLUTE_MAX, maxSeats(0, program));
  const overLimit = limit > 0 && seats > limit;
  const askPin = needsApproval(program, seats);
  const ticketLower = vocab.ticket.toLowerCase();

  let help: string;
  if (program.requireAmount && cents <= 0) help = 'Escribe el monto para ver cuántos sellos se permiten.';
  else if (limit < 1) help = 'Con ' + money(cents) + ' no alcanza para un sello (mínimo ' + money(program.minSpendCentsPerStamp) + ').';
  else if (program.requireAmount) help = 'Con ' + money(cents) + ' se permiten hasta ' + limit + (limit === 1 ? ' sello' : ' sellos') + '.';
  else help = 'Se permiten hasta ' + limit + ' sellos por ' + ticketLower + '.';

  const dec = () => setSeats((s) => Math.max(1, s - 1));
  const inc = () => setSeats((s) => Math.min(limit > 0 ? limit : ABSOLUTE_MAX, s + 1));
  const err = (f: NonNullable<CodeFormState['field']>) => (state.field === f ? state.error : undefined);
  const generalError = state.error && !state.field ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label={'N.º de ' + ticketLower} htmlFor="ticket" error={err('ticket')} hint="El mismo número que sale en el comprobante.">
        <Input id="ticket" name="ticket" value={ticket} onChange={(e) => setTicket(e.target.value)} autoComplete="off" inputMode="text"
          maxLength={40} required aria-invalid={!!err('ticket')} className="h-14 text-lg" />
      </Field>

      {program.requireAmount && (
        <Field label="Monto total (USD)" htmlFor="amount" error={err('amount')}>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">$</span>
            <Input id="amount" name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoComplete="off"
              placeholder="0,00" required aria-invalid={!!err('amount')} aria-describedby="seats-help" className="h-14 pl-9 text-lg tabular-nums" />
          </div>
        </Field>
      )}

      <Field label={vocab.people} error={err('seats')}>
        <div className="flex items-center gap-3" role="group" aria-label={vocab.people}>
          <button type="button" onClick={dec} disabled={seats <= 1} aria-label="Quitar un cupo"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface active:scale-95 disabled:opacity-40">
            <span aria-hidden>−</span>
          </button>
          <output htmlFor="seats" className="min-w-[3.5rem] text-center font-display text-4xl font-bold tabular-nums text-navy" aria-live="polite">{seats}</output>
          <input type="hidden" id="seats" name="seats" value={seats} />
          <button type="button" onClick={inc} disabled={limit > 0 && seats >= limit} aria-label="Agregar un cupo"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface active:scale-95 disabled:opacity-40">
            <span aria-hidden>+</span>
          </button>
          <span className="text-sm text-muted">{seats === 1 ? '1 cupo' : seats + ' cupos'}</span>
        </div>
      </Field>

      <p id="seats-help" aria-live="polite" className={'rounded-xl px-3.5 py-2.5 text-sm ' + (overLimit || (limit < 1 && (!program.requireAmount || cents > 0)) ? 'bg-[#FBE0DE] text-[#9B2A22]' : 'bg-surface text-muted')}>
        {help}
        {overLimit && <span className="block font-semibold">Pediste {seats} cupos: baja a {limit} o sube el monto.</span>}
      </p>

      {askPin && (
        <Field label="PIN de dueño o gerente" htmlFor="pin" error={err('pin')}
          hint={'Más de ' + program.maxSeatsWithoutApproval + ' cupos necesitan aprobación. Pídele el PIN de 4 dígitos a un dueño o gerente.'}>
          <Input id="pin" name="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric" autoComplete="off" maxLength={4} pattern="\d{4}" required aria-invalid={!!err('pin')} className="h-14 w-40 text-center text-xl tracking-[0.5em]" />
        </Field>
      )}

      <div aria-live="assertive" role="status">
        {generalError && <p className="rounded-xl bg-[#FBE0DE] px-3.5 py-2.5 text-sm font-medium text-[#9B2A22]">{generalError}</p>}
      </div>

      <SubmitButton pendingText="Generando…" className="h-14 w-full text-base">Generar código</SubmitButton>
    </form>
  );
}
