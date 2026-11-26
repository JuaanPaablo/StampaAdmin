'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { btnClass, inputClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCents, GIFT_CARD_MAX_CENTS, GIFT_CARD_MIN_CENTS, GIFT_CARD_NOTE_MAX } from '@/lib/domain/wallet-cards';
import { searchGiftCustomersAction, sellGiftCardAction, type CustomerOption, type SellGiftResult } from '@/app/panel/gift-cards/actions';
import { newRequestId } from '@/lib/request-id';
import { GiftCodeDisplay } from './GiftCodeDisplay';

const QUICK = [10, 20, 25, 50];

/** Vender una gift card: monto, cliente opcional y nota. Al terminar muestra el código grande y el QR. */
export function SellGiftForm({ businessName, customerWord }: { businessName: string; customerWord: string }) {
  const uid = useId();
  const [amount, setAmount] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [res, setRes] = useState<SellGiftResult | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const searchSeq = useRef(0);
  // Id de esta venta: se mantiene en los reintentos (si la primera sí se registró, el servidor devuelve esa misma) y
  // se cambia al vender otra.
  const [requestId, setRequestId] = useState('');
  useEffect(() => { setRequestId(newRequestId()); }, []);

  // Búsqueda de clientes con una pausa corta mientras escribe.
  useEffect(() => {
    if (customer) return;
    const q = query.trim();
    if (q.length < 2) { setOptions([]); setSearching(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchGiftCustomersAction(q).catch(() => []);
      if (seq === searchSeq.current) { setOptions(found); setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, customer]);

  useEffect(() => { if (res?.sold) resultRef.current?.focus(); }, [res?.sold]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await sellGiftCardAction(fd);
      setRes(r);
      if (!r.ok && r.fieldErrors?.amount) document.getElementById(`${uid}-amount`)?.focus();
    });
  }

  function reset() {
    setRes(null); setAmount(''); setQuery(''); setCustomer(null); setOptions([]); setRequestId(newRequestId());
    formRef.current?.reset();
    setTimeout(() => document.getElementById(`${uid}-amount`)?.focus(), 0);
  }

  if (res?.ok && res.sold) {
    const s = res.sold;
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 ref={resultRef} tabIndex={-1} className="font-display text-xl font-bold text-navy focus:outline-none">¡Listo! Entrega este código</h2>
        <p className="max-w-md text-center text-sm text-muted">
          Muéstrale esta pantalla para que le tome una foto, o escribe el código en un papel.
          {s.customerName ? ` También aparece en la tarjeta de ${s.customerName}.` : ''}
        </p>
        <GiftCodeDisplay code={s.code} qrSvg={s.qrSvg} balanceCents={s.amountCents} businessName={businessName} customerName={s.customerName} />
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={btnClass('primary')}>Vender otra</button>
          <Link href={`/panel/gift-cards/${s.id}`} className={btnClass('ghost')}>Ver detalle</Link>
          <Link href="/panel/gift-cards" className={btnClass('ghost')}>Volver a la lista</Link>
        </div>
      </div>
    );
  }

  const amountErr = res?.fieldErrors?.amount;
  const listId = `${uid}-list`;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-amount`} className="text-xs font-semibold tracking-wide text-muted">Monto (US$)</label>
        <input id={`${uid}-amount`} name="amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="Ej. 25" required aria-invalid={!!amountErr || undefined} aria-describedby={`${uid}-amount-msg`} className={cn(inputClass, 'text-lg font-semibold')} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Montos rápidos">
          {QUICK.map((n) => (
            <button key={n} type="button" onClick={() => setAmount(String(n))} aria-pressed={amount === String(n)}
              className={cn('h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-inset sm:h-9', amount === String(n) ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
              ${n}
            </button>
          ))}
        </div>
        {amountErr
          ? <p id={`${uid}-amount-msg`} className="text-xs text-bad" role="alert">{amountErr}</p>
          : <p id={`${uid}-amount-msg`} className="text-xs text-muted">Desde {formatCents(GIFT_CARD_MIN_CENTS)} hasta {formatCents(GIFT_CARD_MAX_CENTS)}. Cobra este monto antes de entregarla.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-q`} className="text-xs font-semibold tracking-wide text-muted">{customerWord.charAt(0).toUpperCase() + customerWord.slice(1)} (opcional)</label>
        {customer ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-2.5">
            <span className="min-w-0 text-sm"><strong className="text-navy">{customer.name}</strong> <span className="text-muted">· {customer.contact}</span></span>
            <button type="button" onClick={() => { setCustomer(null); setQuery(''); setTimeout(() => document.getElementById(`${uid}-q`)?.focus(), 0); }} className={btnClass('ghost', 'sm')}>Cambiar</button>
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="customerName" value={customer.name} />
          </div>
        ) : (
          <>
            <input id={`${uid}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off"
              placeholder="Busca por nombre, teléfono o correo" aria-describedby={`${uid}-q-msg`} aria-controls={listId} className={inputClass} />
            <p id={`${uid}-q-msg`} className="text-xs text-muted" aria-live="polite">
              {searching ? 'Buscando…'
                : query.trim().length >= 2 && options.length === 0 ? 'No encontramos a nadie con ese dato. Puedes venderla sin asignarla.'
                : 'Si la asignas, aparece en su tarjeta del celular. Si no, solo sirve con el código.'}
            </p>
            {options.length > 0 && (
              <ul id={listId} className="flex flex-col gap-1 rounded-xl bg-white p-1 ring-1 ring-line" aria-label="Resultados">
                {options.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => { setCustomer(o); setOptions([]); }}
                      className="flex min-h-[44px] w-full flex-col items-start justify-center rounded-lg px-3 py-1.5 text-left hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">
                      <span className="text-sm font-semibold text-navy">{o.name}</span>
                      <span className="text-xs text-muted">{o.contact}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-note`} className="text-xs font-semibold tracking-wide text-muted">Nota (opcional)</label>
        <input id={`${uid}-note`} name="note" maxLength={GIFT_CARD_NOTE_MAX} placeholder="Ej. Regalo de cumpleaños, pagó en efectivo" aria-describedby={`${uid}-note-msg`} className={inputClass} />
        <p id={`${uid}-note-msg`} className="text-xs text-muted">Solo la ves tú en el detalle.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btnClass('primary')}>{pending ? 'Vendiendo…' : 'Vender gift card'}</button>
        <p role="status" aria-live="polite" className="text-sm text-bad">{res && !res.ok ? res.error ?? (res.fieldErrors ? 'Revisa los campos marcados.' : '') : ''}</p>
      </div>
    </form>
  );
}
