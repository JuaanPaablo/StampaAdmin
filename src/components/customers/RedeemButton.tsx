'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';
import { redeemRewardAction } from '@/app/panel/clientes/actions';
import { initialFormState } from './form-state';

function Confirm() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Canjeando…' : 'Sí, canjear ahora'}</Button>;
}

/** Canje con confirmación dentro de la página (sin confirm() del navegador). */
export function RedeemButton({ customerId, customerName, rewardTitle, ready = true }: { customerId: string; customerName: string; rewardTitle: string; ready?: boolean }) {
  const [asking, setAsking] = useState(false);
  const [state, action] = useFormState(redeemRewardAction, initialFormState);

  if (state.ok) {
    return <p role="status" className="mt-4 rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">{state.message}</p>;
  }
  if (!ready) return null;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3 py-2 text-sm text-[#9B2A22]">{state.error}</p>}
      {!asking ? (
        <Button type="button" onClick={() => setAsking(true)} aria-expanded={false}>Canjear premio</Button>
      ) : (
        <form action={action} className="rounded-xl bg-surface p-4" aria-label="Confirmar canje">
          <input type="hidden" name="customerId" value={customerId} />
          <p className="text-sm text-navy">
            ¿Entregar <strong>{rewardTitle}</strong> a <strong>{customerName}</strong>? La tarjeta volverá a empezar y no se puede deshacer.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Confirm />
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
}
