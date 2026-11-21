'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { changeAdminPasswordAction, type PasswordState } from '@/lib/admin-actions';
import { PasswordInput, SubmitButton } from './PasswordInput';

function Submit() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending} label="Cambiar contraseña" pendingLabel="Guardando…" />;
}

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, action] = useFormState<PasswordState, FormData>(changeAdminPasswordAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form ref={ref} action={action} noValidate className="flex flex-col gap-5">
      {/* Ayuda a los gestores de contraseñas a asociar la cuenta */}
      <input type="email" name="username" autoComplete="username" value={email} hidden readOnly />
      <PasswordInput id="current" name="current" label="Contraseña actual" autoComplete="current-password" error={fe.current} />
      <PasswordInput id="password" name="password" label="Contraseña nueva" autoComplete="new-password" minLength={10} error={fe.password} hint="Mínimo 10 caracteres." />
      <PasswordInput id="confirm" name="confirm" label="Repite la contraseña nueva" autoComplete="new-password" error={fe.confirm} />
      <div aria-live="polite" className="min-h-[1.25rem]">
        {state.ok && <p role="status" className="rounded-xl bg-[#DDF3E8] px-3.5 py-3 text-sm text-[#12683F]">Listo. Tu contraseña cambió.</p>}
        {state.error && <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3.5 py-3 text-sm text-[#9B2A22]">{state.error}</p>}
      </div>
      <Submit />
    </form>
  );
}
