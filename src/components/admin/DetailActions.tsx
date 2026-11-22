'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { btnClass, inputClass } from '@/components/ui';
import { resendAccessAction, setStatusAction, updatePlanAction, type AccessLinkState, type AdminActionResult } from '@/lib/admin-actions';
import type { BusinessStatus, Plan } from '@/lib/contracts';
import { cn } from '@/lib/cn';
import { todayEc } from '@/lib/plan-rules';
import { AutoRenewToggle } from './NewAccessForm';
import { AccessLinkPanel } from './AccessLinkPanel';

const label = 'text-xs font-semibold tracking-wide text-muted';

/** Suspender / Reactivar con un paso de confirmación. */
export function StatusControl({ businessId, status, name }: { businessId: string; status: BusinessStatus; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<AdminActionResult | null>(null);
  const suspend = status !== 'suspended';

  function run() {
    const fd = new FormData();
    fd.set('businessId', businessId);
    fd.set('status', suspend ? 'suspended' : 'active');
    start(async () => {
      const r = await setStatusAction(fd);
      setRes(r);
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {suspend
          ? 'Al suspenderlo, el dueño y su equipo no pueden usar el panel y los clientes ven su tarjeta congelada.'
          : 'Al reactivarlo, el negocio vuelve a funcionar con normalidad.'}
      </p>
      {!confirming ? (
        <button type="button" onClick={() => { setRes(null); setConfirming(true); }} className={btnClass(suspend ? 'danger' : 'dark') + ' h-12 self-start'}>
          {suspend ? 'Suspender negocio' : 'Reactivar negocio'}
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby={`conf-${businessId}`} className={cn('flex flex-col gap-3 rounded-xl p-4', suspend ? 'bg-[#FBE9E7]' : 'bg-surface')}>
          <p id={`conf-${businessId}`} className="text-sm font-semibold text-navy">
            {suspend ? `¿Suspender ${name}?` : `¿Reactivar ${name}?`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={run} disabled={pending} autoFocus className={btnClass(suspend ? 'danger' : 'dark') + ' h-12'}>
              {pending ? 'Guardando…' : suspend ? 'Sí, suspender' : 'Sí, reactivar'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={btnClass('ghost') + ' h-12'}>Cancelar</button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className={cn('min-h-[1.25rem] text-sm', res?.ok ? 'text-good' : 'text-bad')}>{res ? (res.ok ? res.message : res.error) : ''}</p>
    </div>
  );
}

/** Plan, vencimiento y nota interna. */
export function PlanForm({ businessId, plan, expires, note, plans, autoRenew }: {
  businessId: string; plan: Plan; expires: string; note: string; plans: { value: Plan; label: string }[]; autoRenew?: boolean;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<AdminActionResult | null>(null);
  const fe = res?.fieldErrors ?? {};

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setRes(await updatePlanAction(fd)));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="currentExpires" value={expires} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan" className={label}>Plan</label>
          <select id="plan" name="plan" defaultValue={plan} className={cn(inputClass, 'h-12 pr-8')}>
            {plans.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {fe.plan && <p role="alert" className="text-xs text-bad">{fe.plan}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expires" className={label}>Vence el</label>
          <input id="expires" name="expires" type="date" min={expires && expires < todayEc() ? expires : todayEc()} defaultValue={expires} className={cn(inputClass, 'h-12', fe.expires && 'border-bad')} aria-describedby="expires-hint" />
          {fe.expires ? <p role="alert" className="text-xs text-bad">{fe.expires}</p> : <p id="expires-hint" className="text-xs text-muted">Vacío = sin vencimiento. Vencer no suspende el negocio.</p>}
        </div>
      </div>
      <AutoRenewToggle defaultChecked={autoRenew} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className={label}>Nota interna</label>
        <textarea id="note" name="note" maxLength={500} defaultValue={note} className={cn(inputClass, 'h-auto min-h-24 py-2.5')} />
        {fe.note && <p role="alert" className="text-xs text-bad">{fe.note}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btnClass('primary') + ' h-12'}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
        <p role="status" aria-live="polite" className={cn('text-sm', res?.ok ? 'text-good' : 'text-bad')}>
          {res ? (res.ok ? res.message : res.error ?? 'Revisa los campos marcados.') : ''}
        </p>
      </div>
    </form>
  );
}

function ResendSubmit({ label: text }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={btnClass('dark') + ' h-12 self-start'}>{pending ? 'Generando enlace…' : text}</button>;
}

/** "Reenviar acceso": invitación si está pendiente; si ya tiene contraseña, enlace para cambiarla. */
export function ResendAccess({ businessId, invitePending, email }: { businessId: string; invitePending: boolean; email: string }) {
  const [state, action] = useFormState<AccessLinkState, FormData>(resendAccessAction, { status: 'idle' });

  if (state.status === 'ok') {
    return <AccessLinkPanel url={state.url} kind={state.kind} shareText={state.shareText} emailStatus={state.emailStatus} to={state.to} />;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="businessId" value={businessId} />
      <p className="text-sm text-muted">
        {invitePending
          ? `Genera una invitación nueva para ${email}. La anterior deja de servir.`
          : `${email} ya creó su contraseña. Genera un enlace para que la cambie (vence en 60 minutos).`}
      </p>
      <ResendSubmit label="Reenviar acceso" />
      {state.status === 'error' && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}
