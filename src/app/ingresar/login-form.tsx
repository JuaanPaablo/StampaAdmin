'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { signIn, type LoginState } from '@/lib/auth';

const label = 'text-sm font-semibold text-navy';
const field = 'h-12 w-full rounded-xl border-[1.5px] bg-white px-3.5 text-base text-navy placeholder:text-[#5A6F86] focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sun text-[15px] font-semibold text-navy transition hover:bg-sun-2 active:scale-[.99] disabled:cursor-wait disabled:opacity-70"
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy motion-reduce:animate-none" aria-hidden="true" />}
      {pending ? 'Ingresando…' : 'Iniciar sesión'}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormState<LoginState, FormData>(signIn, {});
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [help, setHelp] = useState(false);
  const [local, setLocal] = useState<{ email?: string; password?: string } | null>(null);

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const errs: { email?: string; password?: string } = {};
    const email = String(fd.get('email') ?? '').trim();
    if (!email) errs.email = 'Escribe tu correo electrónico.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Revisa el correo: parece incompleto.';
    if (!String(fd.get('password') ?? '')) errs.password = 'Escribe tu contraseña.';
    if (errs.email || errs.password) {
      e.preventDefault();
      setLocal(errs);
      (e.currentTarget.elements.namedItem(errs.email ? 'email' : 'password') as HTMLInputElement | null)?.focus();
    } else setLocal(null);
  }

  const keyCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'));
  const serverError = !local ? state.error : undefined;

  return (
    <form action={action} onSubmit={validate} noValidate className="flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={label}>Correo electrónico</label>
        <input
          id="email" name="email" type="email" autoComplete="username" autoFocus required
          defaultValue={state.email ?? ''} key={state.email ?? 'e'}
          placeholder="nombre@tunegocio.com" inputMode="email" autoCapitalize="none" spellCheck={false}
          aria-invalid={!!local?.email} aria-describedby={local?.email ? 'email-err' : undefined}
          className={field + (local?.email ? ' border-bad' : ' border-[#B7C6D6]')}
          onChange={() => local && setLocal(null)}
        />
        <p id="email-err" role="alert" className="min-h-[1.1rem] text-[13px] text-bad">{local?.email}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className={label}>Contraseña</label>
          <button type="button" onClick={() => setHelp((v) => !v)} aria-expanded={help} aria-controls="ayuda-clave" className="-my-3 rounded px-1 py-3 text-[13px] font-medium text-navy underline underline-offset-2">
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="relative">
          <input
            id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required
            aria-invalid={!!local?.password} aria-describedby={local?.password ? 'pw-err' : caps ? 'caps' : undefined}
            className={field + ' pr-24' + (local?.password ? ' border-bad' : ' border-[#B7C6D6]')}
            onKeyUp={keyCaps} onKeyDown={keyCaps} onBlur={() => setCaps(false)}
            onChange={() => local && setLocal(null)}
          />
          <button
            type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-controls="password"
            className="absolute right-1.5 top-1/2 h-10 -translate-y-1/2 rounded-lg px-3 text-[13px] font-semibold text-navy hover:bg-surface"
          >
            {show ? 'Ocultar' : 'Mostrar'}
            <span className="sr-only"> contraseña</span>
          </button>
        </div>
        <p id="pw-err" role="alert" className="min-h-[1.1rem] text-[13px] text-bad">{local?.password}</p>
        <p id="caps" className="min-h-[1.1rem] text-[13px] text-[#7A5A00]" aria-live="polite">{caps ? 'Bloq Mayús está activado.' : ''}</p>
        {help && (
          <p id="ayuda-clave" className="rounded-xl bg-surface px-3.5 py-3 text-sm leading-snug text-navy">
            Escríbenos a <a href="mailto:soporte@stampa.app" className="rounded font-semibold underline underline-offset-2">soporte@stampa.app</a> y restablecemos tu acceso.
          </p>
        )}
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-navy">
        <input type="checkbox" name="remember" className="h-5 w-5 rounded border-[#8DA2B8] accent-[#001D3D]" />
        Mantener sesión iniciada
      </label>

      {/* Reserva de altura fija: el mensaje no mueve el formulario */}
      <div className="min-h-[3.25rem]" aria-live="polite">
        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FBE0DE] px-3.5 py-3 text-sm leading-snug text-[#9B2A22]">
            <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true"><path d="M10 1.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9.2 5.5h1.6v5.6H9.2V5.5zm0 7.3h1.6v1.7H9.2v-1.7z" /></svg>
            {serverError}
          </p>
        )}
      </div>

      <Submit />
    </form>
  );
}
