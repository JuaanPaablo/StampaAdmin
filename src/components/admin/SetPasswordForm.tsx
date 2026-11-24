'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { setPasswordWithToken, type SetPasswordState } from '@/app/invitacion/actions';
import { cn } from '@/lib/cn';
import { InvalidLinkBody } from './InvalidLink';
import { PasswordInput, SubmitButton, authField, authLabel } from './PasswordInput';
import { useFocusFirstError } from './useFocusFirstError';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending} label={label} pendingLabel="Guardando…" />;
}

/** Formulario de /invitacion (con nombre) y /restablecer (sin nombre). */
export function SetPasswordForm({ token, mode, email, defaultName }: { token: string; mode: 'invite' | 'reset'; email: string; defaultName?: string }) {
  const [state, action] = useFormState<SetPasswordState, FormData>(setPasswordWithToken, {});
  const [pw, setPw] = useState('');
  const ref = useRef<HTMLFormElement>(null);
  const fe = state.fieldErrors ?? {};
  useFocusFirstError(ref, state, Object.keys(fe).length > 0);

  if (state.expired) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3.5 py-3 text-sm font-semibold text-[#9B2A22]">Este enlace ya no sirve.</p>
        <InvalidLinkBody mode={mode} />
      </div>
    );
  }

  return (
    <form ref={ref} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />
      <input type="email" name="username" autoComplete="username" value={email} hidden readOnly />
      {mode === 'invite' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={authLabel}>Tu nombre</label>
          <input
            id="name" name="name" type="text" autoComplete="name" required maxLength={80} autoFocus
            defaultValue={state.name ?? defaultName ?? ''} aria-invalid={!!fe.name} aria-describedby={fe.name ? 'name-err' : 'name-hint'}
            className={cn(authField, fe.name ? 'border-bad' : 'border-[#B7C6D6]')}
          />
          {fe.name ? <p id="name-err" role="alert" className="text-[13px] text-bad">{fe.name}</p> : <p id="name-hint" className="text-[13px] text-muted">Así te verá tu equipo.</p>}
        </div>
      )}
      <PasswordInput
        id="password" name="password" label={mode === 'invite' ? 'Contraseña' : 'Contraseña nueva'} autoComplete="new-password"
        minLength={10} autoFocus={mode === 'reset'} error={fe.password} errorKey={state} onValueChange={setPw}
      />
      <PasswordInput id="confirm" name="confirm" label="Repite la contraseña" autoComplete="new-password" error={fe.confirm} errorKey={state} matchValue={pw} />
      <div aria-live="polite">
        {state.error && <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3.5 py-3 text-sm text-[#9B2A22]">{state.error}</p>}
      </div>
      <Submit label={mode === 'invite' ? 'Crear contraseña y entrar' : 'Cambiar contraseña y entrar'} />
    </form>
  );
}
