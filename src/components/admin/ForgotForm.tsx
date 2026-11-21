'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { requestPasswordReset, type ForgotState } from '@/app/ingresar/olvide/actions';
import { btnClass } from '@/components/ui';
import { SubmitButton, authField, authLabel } from './PasswordInput';

function Submit() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending} label="Enviarme el enlace" pendingLabel="Enviando…" />;
}

export function ForgotForm() {
  const [state, action] = useFormState<ForgotState, FormData>(requestPasswordReset, {});

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl bg-[#DDF3E8] px-3.5 py-3 text-sm leading-snug text-[#12683F]">
          Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña. Vence en 60 minutos.
        </p>
        <p className="text-sm text-muted">Revisa también la carpeta de spam. ¿No te llegó? Vuelve a pedirlo en unos minutos.</p>
        {state.previewUrl && (
          <div className="rounded-xl bg-[#FFF3CC] px-3.5 py-3 text-sm text-[#7A5A00]">
            <p className="font-semibold">Modo de prueba: el correo no se envió.</p>
            <a href={state.previewUrl} className="mt-1 block break-all font-medium text-navy underline underline-offset-2">{state.previewUrl}</a>
          </div>
        )}
        <Link href="/ingresar" className={btnClass('ghost') + ' h-12 w-full'}>Volver a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={authLabel}>Correo electrónico</label>
        <input
          id="email" name="email" type="email" autoComplete="username" required autoFocus inputMode="email" autoCapitalize="none" spellCheck={false}
          maxLength={254} defaultValue={state.email ?? ''} key={state.email ?? 'e'} placeholder="nombre@tunegocio.com"
          aria-invalid={!!state.error} aria-describedby={state.error ? 'email-err' : undefined}
          className={authField + (state.error ? ' border-bad' : ' border-[#B7C6D6]')}
        />
        {state.error && <p id="email-err" role="alert" className="text-[13px] text-bad">{state.error}</p>}
      </div>
      <Submit />
      <Link href="/ingresar" className="text-center text-sm font-semibold text-navy underline underline-offset-2">Volver a iniciar sesión</Link>
    </form>
  );
}
