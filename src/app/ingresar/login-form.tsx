'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { Field, Select, btnClass } from '@/components/ui';
import { signInAction } from './actions';

export interface LoginBusiness {
  id: string; name: string; typeLabel: string;
  staff: { id: string; name: string; role: string; pin?: string }[];
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const keyCls = 'h-14 rounded-xl bg-surface text-xl font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] transition hover:bg-[#E6EDF5] active:scale-95';

export function LoginForm({ businesses }: { businesses: LoginBusiness[] }) {
  const router = useRouter();
  const uid = useId();
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? '');
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<{ field?: 'business' | 'staff' | 'pin'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pinRef = useRef<HTMLInputElement>(null);

  const business = businesses.find((b) => b.id === businessId);
  const demoRows = (business?.staff ?? []).filter((s) => s.pin);

  function press(d: string) { setError(null); setPin((p) => (p.length < 4 ? p + d : p)); }
  function erase() { setError(null); setPin((p) => p.slice(0, -1)); }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!staffId) { setError({ field: 'staff', text: 'Elige quién eres.' }); return; }
    if (pin.length !== 4) { setError({ field: 'pin', text: 'El PIN tiene 4 dígitos.' }); pinRef.current?.focus(); return; }
    setError(null);
    start(async () => {
      const r = await signInAction({ businessId, staffId, pin });
      if (r.ok) { router.push(r.redirectTo); router.refresh(); return; }
      setError({ field: r.field, text: r.error });
      if (r.field === 'pin') { setPin(''); pinRef.current?.focus(); }
    });
  }

  const errFor = (f: 'business' | 'staff' | 'pin') => (error?.field === f ? error.text : undefined);
  const generic = error && !error.field ? error.text : undefined;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Negocio" htmlFor={uid + 'biz'} error={errFor('business')}>
        <Select id={uid + 'biz'} value={businessId} onChange={(e) => { setBusinessId(e.target.value); setStaffId(''); setPin(''); setError(null); }}>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.typeLabel}</option>)}
        </Select>
      </Field>

      <Field label="¿Quién eres?" htmlFor={uid + 'staff'} error={errFor('staff')}>
        <Select id={uid + 'staff'} value={staffId} onChange={(e) => { setStaffId(e.target.value); setError(null); }} aria-invalid={error?.field === 'staff'}>
          <option value="">Elige tu nombre</option>
          {(business?.staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <label htmlFor={uid + 'pin'} className="text-xs font-semibold tracking-wide text-muted">PIN de 4 dígitos</label>
        <input
          ref={pinRef}
          id={uid + 'pin'}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => { setError(null); setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); }}
          aria-invalid={error?.field === 'pin'}
          aria-describedby={uid + 'pin-msg'}
          className="h-12 w-full rounded-xl border-[1.5px] border-[#C9D6E3] bg-white px-4 text-center font-mono text-2xl tracking-[0.6em] text-navy focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50"
        />
        <div className="flex justify-center gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className={'h-2.5 w-2.5 rounded-full ' + (i < pin.length ? 'bg-navy' : 'bg-[#C9D6E3]')} />)}
        </div>
        <p id={uid + 'pin-msg'} className="min-h-[1.25rem] text-center text-xs text-bad" role="alert">{errFor('pin')}</p>

        <div role="group" aria-label="Teclado numérico" className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2">
          {KEYS.map((k) => <button key={k} type="button" onClick={() => press(k)} className={keyCls} aria-label={k}>{k}</button>)}
          <button type="button" onClick={() => { setPin(''); setError(null); }} className={keyCls + ' text-sm'} aria-label="Borrar todo">Limpiar</button>
          <button type="button" onClick={() => press('0')} className={keyCls} aria-label="0">0</button>
          <button type="button" onClick={erase} className={keyCls + ' text-sm'} aria-label="Borrar el último dígito">Borrar</button>
        </div>
      </div>

      {generic && <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3 py-2 text-sm text-[#9B2A22]">{generic}</p>}

      <button type="submit" disabled={pending} className={btnClass('primary') + ' w-full'}>
        {pending ? 'Verificando…' : 'Entrar'}
      </button>

      {demoRows.length > 0 && (
        <details className="rounded-xl bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-navy">Credenciales de prueba</summary>
          <p className="mt-2 text-xs text-muted">Solo para negocios de demostración. Los negocios que crees tú no aparecen aquí.</p>
          <ul className="mt-2 divide-y divide-line">
            {demoRows.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0"><span className="block truncate font-medium text-navy">{s.name}</span><span className="text-xs text-muted">{s.role}</span></span>
                <span className="font-mono text-base font-semibold text-navy">{s.pin}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </form>
  );
}
