'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';
import { redeemRewardAction } from '@/app/panel/clientes/actions';
import { initialFormState } from './form-state';

function Confirm() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Canjeando…' : 'Sí, entregar'}</Button>;
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return <Button type="button" variant="ghost" disabled={pending} onClick={onClick}>Cancelar</Button>;
}

type Reward = { title: string; milestone?: number };

/**
 * Canje de los premios pendientes, con confirmación dentro de la página (sin confirm() del navegador).
 * El mensaje de éxito vive aquí y no en cada botón: al canjear, el servidor quita el premio de la lista
 * y el aviso tiene que seguir visible.
 */
export function RedeemButton({ customerId, customerName, rewards }: { customerId: string; customerName: string; rewards: Reward[] }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [state, action] = useFormState(redeemRewardAction, initialFormState);
  const keyOf = (r: Reward) => String(r.milestone ?? 'final');
  const current = rewards.find((r) => keyOf(r) === asking);

  // Tras un resultado (éxito o error) se cierra la confirmación.
  useEffect(() => { setAsking(null); }, [state]);
  // Al abrir la confirmación, el foco va a la pregunta para que el lector de pantalla la lea primero.
  useEffect(() => { if (asking) document.getElementById('redeem-confirm-text')?.focus(); }, [asking]);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div role="status" aria-live="polite">
        {state.ok && state.message && (
          <p className="rounded-xl bg-[#DDF3E8] px-4 py-3 text-sm font-medium text-[#12683F]">{state.message}</p>
        )}
      </div>
      {!state.ok && state.error && (
        <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3 py-2 text-sm text-[#9B2A22]">{state.error}</p>
      )}
      {current ? (
        <form action={action} className="rounded-xl bg-surface p-4 ring-1 ring-line" aria-labelledby="redeem-confirm-text">
          <input type="hidden" name="customerId" value={customerId} />
          {current.milestone && <input type="hidden" name="milestone" value={current.milestone} />}
          <p id="redeem-confirm-text" tabIndex={-1} className="text-sm text-navy focus:outline-none">
            ¿Entregar <strong>{current.title}</strong> a <strong>{customerName}</strong> ahora?{' '}
            {current.milestone ? 'Conserva sus sellos.' : 'Su tarjeta vuelve a empezar.'} No se puede deshacer.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Confirm />
            <CancelBtn onClick={() => setAsking(null)} />
          </div>
        </form>
      ) : (
        rewards.map((r) => (
          <Button key={keyOf(r)} type="button" onClick={() => setAsking(keyOf(r))}>
            {r.milestone ? `Canjear: ${r.title}` : 'Canjear premio'}
          </Button>
        ))
      )}
    </div>
  );
}
