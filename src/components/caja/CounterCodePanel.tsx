'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFormState } from 'react-dom';
import { Badge, btnClass, Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/register/SubmitButton';
import { cn } from '@/lib/cn';
import { newRequestId } from '@/lib/request-id';
import { formatCents, parseGiftCardAmount, validateGiftCardCharge, validateGiftCardLoad } from '@/lib/domain/wallet-cards';
import type { GiftCardMovementKind } from '@/lib/contracts';
import { counterAction } from '@/app/panel/caja/tarjetas-actions';
import { initialCounterState, type CounterField, type CounterState, type CouponView, type GiftView } from './types';

/**
 * Caja → "Cupón o gift card": escanear (lector USB/Bluetooth, que escribe y manda Enter) o escribir el código,
 * ver el cupón o la gift card y canjear, cobrar o recargar. Todo pasa por una sola server action con `intent`.
 */
export function CounterCodePanel({ canTopup }: { canTopup: boolean }) {
  const [state, formAction] = useFormState<CounterState, FormData>(counterAction, initialCounterState);
  const [code, setCode] = useState('');
  const [clearedSeq, setClearedSeq] = useState(-1);
  const codeRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastItemId = useRef<string | undefined>();

  const item = state.seq === clearedSeq ? undefined : state.item;
  // Tras un éxito el panel se vuelve a montar (limpia montos y confirmaciones); tras un error conserva lo escrito.
  const panelKey = item ? item.id + (state.message ? ':' + state.seq : '') : '';
  const err = (f: CounterField) => (state.seq !== clearedSeq && state.field === f ? state.error : undefined);
  const generalError = state.seq !== clearedSeq && state.error && (!state.field || (state.field === 'code' && !!item)) ? state.error : undefined;

  useEffect(() => {
    if (state.seq === 0) return;
    if (state.field === 'code') {
      codeRef.current?.focus();
      codeRef.current?.select();
      return;
    }
    // Un cupón o gift card nuevo en pantalla: el foco va a su título (lectores de pantalla) salvo con lector de códigos
    // en PC, donde conviene dejar el campo listo para el siguiente escaneo.
    if (state.item && state.item.id !== lastItemId.current) {
      if (window.matchMedia?.('(pointer: fine)').matches) codeRef.current?.select();
      else headingRef.current?.focus();
    }
    lastItemId.current = state.item?.id;
  }, [state]);

  const clear = () => {
    setClearedSeq(state.seq);
    setCode('');
    lastItemId.current = undefined;
    codeRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <input type="hidden" name="intent" value="lookup" />
        <div className="flex-1">
          <Field label="Código del cupón o de la gift card" htmlFor="counter-code" error={err('code') && !item ? err('code') : undefined}
            hint="Escanea el QR con el lector o escribe los 12 caracteres de la gift card.">
            <Input ref={codeRef} id="counter-code" name="code" value={code} onChange={(e) => setCode(e.target.value)}
              autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search"
              maxLength={120} placeholder="ABCD EFGH JKMN" className="h-14 text-lg tracking-wide" />
          </Field>
        </div>
        <SubmitButton pendingText="Buscando…" className="h-14 sm:w-auto">Buscar</SubmitButton>
      </form>

      <div aria-live="polite" role="status">
        {state.seq !== clearedSeq && state.message && (
          <p className="rounded-2xl bg-[#DDF3E8] px-4 py-3 text-sm font-semibold text-[#12683F]">{state.message}</p>
        )}
      </div>
      {generalError && <p role="alert" className="rounded-2xl bg-[#FBE0DE] px-4 py-3 text-sm font-medium text-[#9B2A22]">{generalError}</p>}

      {item?.kind === 'coupon' && <CouponPanel key={panelKey} seq={state.seq} item={item} formAction={formAction} headingRef={headingRef} />}
      {item?.kind === 'gift' && (
        <GiftPanel key={panelKey} seq={state.seq} item={item} formAction={formAction} headingRef={headingRef} canTopup={canTopup}
          chargeError={err('charge')} topupError={err('topup')} />
      )}

      {item && (
        <button type="button" onClick={clear} className={cn(btnClass('ghost', 'sm'), 'self-start')}>Escanear otro código</button>
      )}
    </div>
  );
}

type FormAction = (fd: FormData) => void;

function CouponPanel({ item, seq, formAction, headingRef }: { item: CouponView; seq: number; formAction: FormAction; headingRef: RefObject<HTMLHeadingElement> }) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (armed) confirmRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus(); }, [armed]);
  useEffect(() => { setArmed(false); }, [seq]);
  const ok = !item.problem;

  return (
    <article className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5" aria-labelledby="counter-item-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cupón de {item.customerName}</p>
          <h3 id="counter-item-title" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-xl font-bold text-navy focus:outline-none">{item.title}</h3>
        </div>
        <Badge tone={ok ? 'ok' : item.redeemedAt ? 'neutral' : 'bad'}>{item.statusLabel}</Badge>
      </div>
      {item.description && <p className="mt-2 text-[15px] text-navy">{item.description}</p>}
      {item.terms && <p className="mt-2 text-xs text-muted">Condiciones: {item.terms}</p>}
      <p className="mt-2 text-sm text-muted">{item.validity}</p>

      {item.problem ? (
        <p className="mt-4 rounded-xl bg-[#FBE0DE] px-3.5 py-2.5 text-sm font-semibold text-[#9B2A22]">{item.problem}</p>
      ) : (
        <form action={formAction} className="mt-4" onKeyDown={(e) => { if (armed && e.key === 'Escape') setArmed(false); }}>
          <input type="hidden" name="intent" value="redeem" />
          <input type="hidden" name="id" value={item.id} />
          {!armed ? (
            <button type="button" onClick={() => setArmed(true)} className={cn(btnClass('primary'), 'h-12 w-full sm:w-auto')}>Canjear cupón</button>
          ) : (
            <div ref={confirmRef} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-navy">¿Canjear «{item.title}» para {item.customerName}? Solo se puede usar una vez.</p>
              <div className="flex flex-wrap gap-2">
                <SubmitButton variant="dark" pendingText="Canjeando…" className="h-12">Sí, canjear</SubmitButton>
                <button type="button" onClick={() => setArmed(false)} className={cn(btnClass('ghost'), 'h-12')}>No, volver</button>
              </div>
            </div>
          )}
        </form>
      )}
    </article>
  );
}

const KIND_LABEL: Record<GiftCardMovementKind, string> = { issue: 'Venta', topup: 'Recarga', charge: 'Cobro', void: 'Anulación', adjust: 'Ajuste' };

function GiftPanel({ item, seq, formAction, headingRef, canTopup, chargeError, topupError }: {
  item: GiftView; seq: number; formAction: FormAction; headingRef: RefObject<HTMLHeadingElement>; canTopup: boolean; chargeError?: string; topupError?: string;
}) {
  const active = item.status === 'active';
  return (
    <article className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5" aria-labelledby="counter-item-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Gift card <span className="tabular-nums">{item.maskedCode}</span>{item.customerName ? ` · ${item.customerName}` : ''}
          </p>
          <h3 id="counter-item-title" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl font-bold tabular-nums text-navy focus:outline-none">
            <span className="sr-only">Saldo: </span>{formatCents(item.balanceCents)}
          </h3>
          <p className="text-xs text-muted">Saldo disponible</p>
        </div>
        <Badge tone={active ? 'ok' : 'bad'}>{active ? 'Activa' : 'Anulada'}</Badge>
      </div>

      {!active && <p className="mt-4 rounded-xl bg-[#FBE0DE] px-3.5 py-2.5 text-sm font-semibold text-[#9B2A22]">Esta gift card está anulada: no se puede cobrar ni recargar.</p>}
      {active && item.balanceCents === 0 && <p className="mt-4 text-sm font-medium text-navy">Sin saldo. {canTopup ? 'Puedes recargarla abajo.' : 'Un dueño o gerente puede recargarla.'}</p>}

      {active && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {item.balanceCents > 0 && (
            <AmountForm intent="charge" seq={seq} item={item} formAction={formAction} serverError={chargeError}
              label="Monto a cobrar (USD)" button="Cobrar" confirmVerb="Sí, cobrar" pendingText="Cobrando…" />
          )}
          {canTopup && (
            <AmountForm intent="topup" seq={seq} item={item} formAction={formAction} serverError={topupError}
              label="Monto a recargar (USD)" button="Recargar" confirmVerb="Sí, recargar" pendingText="Recargando…" />
          )}
        </div>
      )}

      {item.movements.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Últimos movimientos</h4>
          <ul className="mt-2 divide-y divide-line rounded-xl bg-white ring-1 ring-line">
            {item.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-navy">{KIND_LABEL[m.kind]}</span>
                  <span className="ml-2 text-xs text-muted">{m.at}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className={cn('font-semibold', m.amountCents < 0 ? 'text-bad' : 'text-[#12683F]')}>
                    {m.amountCents > 0 ? '+' : ''}{formatCents(m.amountCents)}
                  </span>
                  <span className="block text-xs text-muted">Saldo {formatCents(m.balanceAfterCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function AmountForm({ intent, seq, item, formAction, serverError, label, button, confirmVerb, pendingText }: {
  intent: 'charge' | 'topup'; seq: number; item: GiftView; formAction: FormAction; serverError?: string;
  label: string; button: string; confirmVerb: string; pendingText: string;
}) {
  const [amount, setAmount] = useState('');
  const [armed, setArmed] = useState<number | null>(null);
  const [requestId, setRequestId] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const id = `gift-${intent}`;
  const error = localError ?? serverError;

  // Cada respuesta del servidor desarma la confirmación; si fue un error de este monto, el foco vuelve al campo.
  useEffect(() => {
    setArmed(null);
    if (serverError) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
  useEffect(() => { if (armed !== null) confirmRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus(); }, [armed]);

  const arm = () => {
    const parsed = parseGiftCardAmount(amount);
    const problem = !parsed.ok ? parsed.error
      : intent === 'charge' ? validateGiftCardCharge(parsed.cents, { balanceCents: item.balanceCents, status: item.status })
      : validateGiftCardLoad(parsed.cents, item.balanceCents);
    if (problem || !parsed.ok) { setLocalError(problem ?? undefined); inputRef.current?.focus(); return; }
    setLocalError(undefined);
    setRequestId(newRequestId());   // uno por confirmación: un doble toque no cobra dos veces
    setArmed(parsed.cents);
  };

  const after = armed === null ? 0 : intent === 'charge' ? item.balanceCents - armed : item.balanceCents + armed;

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl bg-white p-3.5 ring-1 ring-line" noValidate
      onKeyDown={(e) => { if (armed !== null && e.key === 'Escape') setArmed(null); }}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={item.id} />
      {armed !== null && <input type="hidden" name="requestId" value={requestId} />}
      <Field label={label} htmlFor={id} error={error}>
        <Input ref={inputRef} id={id} name="amount" value={amount} inputMode="decimal" autoComplete="off" placeholder="0,00" readOnly={armed !== null}
          onChange={(e) => { setAmount(e.target.value); setLocalError(undefined); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && armed === null) { e.preventDefault(); arm(); } }}
          className="h-12 text-lg tabular-nums" />
      </Field>
      {armed === null ? (
        <button type="button" onClick={arm} className={cn(btnClass(intent === 'charge' ? 'primary' : 'ghost'), 'h-12 w-full')}>{button}</button>
      ) : (
        <div ref={confirmRef} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-navy">
            ¿{intent === 'charge' ? 'Cobrar' : 'Recargar'} {formatCents(armed)}? El saldo quedará en {formatCents(after)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="dark" pendingText={pendingText} className="h-12 flex-1">{confirmVerb}</SubmitButton>
            <button type="button" onClick={() => { setArmed(null); inputRef.current?.focus(); }} className={cn(btnClass('ghost'), 'h-12')}>No, volver</button>
          </div>
        </div>
      )}
    </form>
  );
}
