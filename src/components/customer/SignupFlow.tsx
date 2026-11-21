'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { flowAction } from '@/app/u/actions';
import { BirthdateFields, type BirthValue } from './BirthdateFields';
import { fieldInput, linkBtn, Notice, primaryBtn } from './Shell';
import type { FlowState } from './types';

function Submit({ children, pendingText, name, value }: { children: string; pendingText: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} className={primaryBtn} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>;
}

function SmallSubmit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={linkBtn} disabled={pending}>{children}</button>;
}

export interface SignupFlowProps {
  /** Negocio donde ocurre (ausente en /mis-tarjetas: solo ingreso). */
  slug?: string;
  businessName?: string;
  /** El negocio acepta clientes nuevos. Si es false, solo "Ya tengo tarjeta". */
  allowSignup: boolean;
  initialMode?: 'alta' | 'ingreso';
  /** Código de sello por reclamar al terminar. */
  stampCode?: string;
  /** Datos pendientes leídos de la cookie firmada (para retomar la pantalla del código tras recargar). */
  resume?: { mode: 'alta' | 'ingreso'; email: string };
}

/** Alta (nombre, fecha, correo, consentimiento) o ingreso (solo correo) → código de 6 dígitos por correo. */
export function SignupFlow({ slug, businessName, allowSignup, initialMode = 'alta', stampCode, resume }: SignupFlowProps) {
  const start: FlowState = resume
    ? { step: 'code', mode: resume.mode, email: resume.email }
    : { step: 'form', mode: allowSignup ? initialMode : 'ingreso' };
  const [state, action] = useFormState<FlowState, FormData>(flowAction, start);
  const [mode, setMode] = useState<'alta' | 'ingreso'>(start.mode);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<BirthValue>({ day: '', month: '', year: '' });
  const [email, setEmail] = useState(resume?.email ?? '');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);

  // Al cambiar de paso, el foco va al título (lectores de pantalla) y se limpia el código.
  useEffect(() => {
    setCode('');
    if (state.step === 'code') heading.current?.focus();
  }, [state.step, state.nonce]);
  useEffect(() => { if (state.mode) setMode(state.mode); }, [state.mode]);

  const fe = state.fieldErrors ?? {};

  if (state.step === 'code') {
    return (
      <div className="space-y-4">
        <div>
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold text-navy outline-none">Revisa tu correo</h2>
          <p className="mt-1 text-[15px] text-navy">Te enviamos un código a <strong className="break-all">{state.email}</strong>.</p>
          <p className="text-sm text-muted">Vence en 10 minutos. Si no lo ves, revisa la carpeta de correo no deseado.</p>
        </div>
        {state.previewCode && (
          <Notice tone="warning" title={`Tu código es ${state.previewCode}`}>Modo de prueba: el correo no se envió.</Notice>
        )}
        {state.notice && !state.error && <Notice tone="info">{state.notice}</Notice>}
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <form action={action} className="space-y-3">
          <input type="hidden" name="intent" value="verify" />
          <label htmlFor="otp" className="block text-sm font-semibold text-navy">Código de 6 números</label>
          <input
            id="otp" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
            aria-invalid={!!fe.code} aria-describedby={fe.code ? 'otp-err' : undefined}
            className={fieldInput + ' text-center font-display text-2xl font-bold tracking-[0.4em]'}
          />
          {fe.code && <p id="otp-err" className="text-sm font-medium text-bad">{fe.code}</p>}
          <Submit pendingText="Confirmando…">Confirmar</Submit>
        </form>
        <div className="flex items-center justify-between gap-2">
          <form action={action}><input type="hidden" name="intent" value="resend" /><SmallSubmit>Reenviar código</SmallSubmit></form>
          <form action={action}><input type="hidden" name="intent" value="cancel" /><SmallSubmit>Cambiar correo</SmallSubmit></form>
        </div>
      </div>
    );
  }

  const alta = mode === 'alta';
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="intent" value="request" />
      <input type="hidden" name="mode" value={mode} />
      {slug && <input type="hidden" name="slug" value={slug} />}
      {stampCode && <input type="hidden" name="stampCode" value={stampCode} />}

      <div>
        <h2 className="font-display text-2xl font-bold text-navy">{alta ? 'Crea tu tarjeta' : 'Abre tu tarjeta'}</h2>
        <p className="mt-1 text-sm text-muted">
          {alta
            ? `Es gratis y sin apps que descargar. Te enviaremos un código a tu correo para confirmarlo.`
            : `Escribe el correo con el que te registraste${businessName ? ` en ${businessName}` : ''}. Te enviaremos un código.`}
        </p>
      </div>

      {state.error && <Notice tone="error">{state.error}</Notice>}

      {alta && (
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-navy">Tu nombre</label>
          <input id="name" name="name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ej.: María Pérez" aria-invalid={!!fe.name} aria-describedby={fe.name ? 'name-err' : undefined} className={fieldInput} />
          {fe.name && <p id="name-err" className="mt-1 text-sm font-medium text-bad">{fe.name}</p>}
        </div>
      )}
      {alta && <BirthdateFields value={birth} onChange={setBirth} error={fe.birth} />}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-navy">Tu correo</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254}
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com"
          aria-invalid={!!fe.email} aria-describedby={fe.email ? 'email-err' : undefined} className={fieldInput} />
        {fe.email && <p id="email-err" className="mt-1 text-sm font-medium text-bad">{fe.email}</p>}
      </div>

      {alta && (
        <div>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
            <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} required
              aria-invalid={!!fe.consent} aria-describedby={fe.consent ? 'consent-err' : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#001D3D]" />
            <span className="text-sm text-navy">
              Acepto el tratamiento de mis datos según la <Link href="/privacidad" target="_blank" className="font-semibold underline underline-offset-2">política de privacidad</Link>.
            </span>
          </label>
          {fe.consent && <p id="consent-err" className="mt-1 text-sm font-medium text-bad">{fe.consent}</p>}
        </div>
      )}

      <Submit pendingText="Enviando el código…">{alta ? 'Recibir mi código' : 'Enviarme el código'}</Submit>

      {allowSignup && (
        <p className="text-center">
          <button type="button" className={linkBtn} onClick={() => setMode(alta ? 'ingreso' : 'alta')}>
            {alta ? 'Ya tengo tarjeta' : 'Soy nuevo: crear mi tarjeta'}
          </button>
        </p>
      )}
    </form>
  );
}
