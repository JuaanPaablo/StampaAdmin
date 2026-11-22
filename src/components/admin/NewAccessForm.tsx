'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { Card, btnClass, inputClass } from '@/components/ui';
import { createAccessAction, type AccessLinkState } from '@/lib/admin-actions';
import type { Plan } from '@/lib/contracts';
import { cn } from '@/lib/cn';
import { todayEc } from '@/lib/plan-rules';
import { AccessLinkPanel } from './AccessLinkPanel';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={btnClass('primary') + ' h-12 w-full sm:w-auto'}>
      {pending ? 'Creando acceso…' : 'Dar acceso'}
    </button>
  );
}

const label = 'text-xs font-semibold tracking-wide text-muted';

/**
 * Formulario "Dar acceso a un negocio". La confirmación (con el enlace en claro) se pinta con la respuesta de la acción:
 * el token nunca pasa por la URL ni se guarda en el navegador.
 */
export function NewAccessForm({ plans, defaultPlan }: { plans: { value: Plan; label: string }[]; defaultPlan: Plan }) {
  const [state, action] = useFormState<AccessLinkState, FormData>(createAccessAction, { status: 'idle' });

  if (state.status === 'ok') {
    return (
      <Card className="mx-auto max-w-xl">
        <h2 className="font-display text-xl font-bold text-navy">Acceso creado</h2>
        <p className="mt-1 text-sm text-muted">
          Envía este enlace a <strong className="font-semibold text-navy">{state.to}</strong>. Con él crea su contraseña y configura su negocio.
        </p>
        <div className="mt-5"><AccessLinkPanel url={state.url} kind={state.kind} shareText={state.shareText} emailStatus={state.emailStatus} to={state.to} /></div>
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
          <Link href={`/admin/negocios/${state.businessId}`} className={btnClass('ghost') + ' sm:flex-1'}>Ver el negocio</Link>
          {/* Recarga completa: limpia el estado y el enlace de la memoria de la página */}
          <a href="/admin/negocios/nuevo" className={btnClass('ghost') + ' sm:flex-1'}>Dar acceso a otro negocio</a>
        </div>
      </Card>
    );
  }

  const fe = state.status === 'error' ? state.fieldErrors ?? {} : {};
  const v = state.status === 'error' ? state.values ?? {} : {};
  const err = (name: string) => fe[name] ? <p id={`${name}-err`} role="alert" className="text-xs text-bad">{fe[name]}</p> : null;

  return (
    <Card className="mx-auto max-w-xl">
      <form action={action} noValidate className="flex flex-col gap-5" key={JSON.stringify(v)}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={label}>Correo del dueño</label>
          <input
            id="email" name="email" type="email" required autoComplete="off" inputMode="email" autoCapitalize="none" spellCheck={false}
            maxLength={254} defaultValue={v.email ?? ''} placeholder="dueño@sunegocio.com" autoFocus
            aria-invalid={!!fe.email} aria-describedby={fe.email ? 'email-err' : 'email-hint'}
            className={cn(inputClass, 'h-12', fe.email && 'border-bad')}
          />
          {err('email') ?? <p id="email-hint" className="text-xs text-muted">Con este correo entrará a su panel.</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan" className={label}>Plan</label>
            <select id="plan" name="plan" defaultValue={v.plan || defaultPlan} aria-invalid={!!fe.plan} aria-describedby={fe.plan ? 'plan-err' : undefined} className={cn(inputClass, 'h-12 pr-8')}>
              {plans.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {err('plan')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expires" className={label}>Vence el (opcional)</label>
            <input id="expires" name="expires" type="date" min={todayEc()} defaultValue={v.expires ?? ''} aria-invalid={!!fe.expires} aria-describedby={fe.expires ? 'expires-err' : 'expires-hint'} className={cn(inputClass, 'h-12', fe.expires && 'border-bad')} />
            {err('expires') ?? <p id="expires-hint" className="text-xs text-muted">Vacío = sin vencimiento.</p>}
          </div>
        </div>

        <AutoRenewToggle defaultChecked={v.autoRenew === 'on'} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="note" className={label}>Nota interna (opcional)</label>
          <textarea id="note" name="note" maxLength={500} defaultValue={v.note ?? ''} placeholder="Ej.: Pizzería, 5 sucursales. Pagó 3 meses." aria-describedby={fe.note ? 'note-err' : 'note-hint'} className={cn(inputClass, 'h-auto min-h-24 py-2.5')} />
          {err('note') ?? <p id="note-hint" className="text-xs text-muted">Solo la ve Stampa.</p>}
        </div>

        {state.status === 'error' && !Object.keys(fe).length && (
          <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3.5 py-3 text-sm text-[#9B2A22]">{state.error}</p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/admin/negocios" className={btnClass('ghost') + ' h-12'}>Cancelar</Link>
          <Submit />
        </div>
        <p className="text-xs text-muted">El dueño pone el nombre, el logo y la tarjeta de su negocio cuando entra por primera vez.</p>
      </form>
    </Card>
  );
}

/** Casilla "Renovar automáticamente cada mes" (la usan dar acceso y editar plan). */
export function AutoRenewToggle({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface px-4 py-3">
      <input type="checkbox" name="autoRenew" defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-[#001D3D]" />
      <span>
        <span className="block text-sm font-semibold text-navy">Renovar automáticamente cada mes</span>
        <span className="block text-xs text-muted">Al vencer, la fecha pasa sola al mes siguiente. No tienes que cambiarla a mano.</span>
      </span>
    </label>
  );
}
