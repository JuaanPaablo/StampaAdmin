'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { adminSignIn, type AdminLoginState } from '@/lib/admin-actions';
import { PasswordInput, SubmitButton, authField, authLabel } from './PasswordInput';

function Submit() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending} label="Entrar" pendingLabel="Entrando…" />;
}

export function AdminLoginForm() {
  const [state, action] = useFormState<AdminLoginState, FormData>(adminSignIn, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={authLabel}>Correo</label>
        <input
          id="email" name="email" type="email" autoComplete="username" required autoFocus inputMode="email" autoCapitalize="none" spellCheck={false}
          maxLength={254} defaultValue={state.email ?? ''} key={state.email ?? 'e'} className={authField + ' border-[#B7C6D6]'}
        />
      </div>
      <PasswordInput id="password" name="password" label="Contraseña" autoComplete="current-password" />
      <div aria-live="polite" className="min-h-[3.25rem]">
        {state.error && <p role="alert" className="rounded-xl bg-[#FBE0DE] px-3.5 py-3 text-sm leading-snug text-[#9B2A22]">{state.error}</p>}
      </div>
      <Submit />
    </form>
  );
}
