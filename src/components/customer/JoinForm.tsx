'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { joinAction } from '@/app/u/actions';
import { BirthdateFields, type BirthValue } from './BirthdateFields';
import { fieldInput, Notice, primaryBtn } from './Shell';
import type { SimpleState } from './types';

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className={primaryBtn} disabled={pending}>{pending ? 'Creando tu tarjeta…' : children}</button>
      <span role="status" className="sr-only">{pending ? 'Creando tu tarjeta…' : ''}</span>
    </>
  );
}

export interface JoinPrefill { name?: string; day?: number; month?: number; year?: number }

/** Cliente con sesión (correo ya verificado) que aún no tiene tarjeta en este negocio. */
export function JoinForm({ slug, businessName, email, prefill, stampCode }: { slug: string; businessName: string; email: string; prefill?: JoinPrefill; stampCode?: string }) {
  const [state, action] = useFormState<SimpleState, FormData>(joinAction, {});
  const [name, setName] = useState(prefill?.name ?? '');
  const [birth, setBirth] = useState<BirthValue>({
    day: prefill?.day ? String(prefill.day) : '', month: prefill?.month !== undefined ? String(prefill.month) : '', year: prefill?.year ? String(prefill.year) : ''
  });
  const [consent, setConsent] = useState(false);
  const fe = state.fieldErrors ?? {};
  const form = useRef<HTMLFormElement>(null);
  // Tras un error, el foco va al primer dato marcado para corregirlo sin buscarlo.
  useEffect(() => {
    if (state.fieldErrors) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {stampCode && <input type="hidden" name="stampCode" value={stampCode} />}
      <div>
        <h2 className="font-display text-2xl font-bold text-navy">Únete a {businessName}</h2>
        <p className="mt-1 text-sm text-muted">Tu correo ya está confirmado: <strong className="break-all text-navy">{email}</strong></p>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div>
        <label htmlFor="join-name" className="mb-1.5 block text-sm font-semibold text-navy">Tu nombre</label>
        <input id="join-name" name="name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
          aria-invalid={!!fe.name} aria-describedby={fe.name ? 'join-name-err' : undefined} className={fieldInput} />
        {fe.name && <p id="join-name-err" className="mt-1 text-sm font-medium text-bad">{fe.name}</p>}
      </div>
      <BirthdateFields value={birth} onChange={setBirth} error={fe.birth} idPrefix="join-nac" />
      <div>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={!!fe.consent} aria-describedby={fe.consent ? 'join-consent-err' : undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-[#001D3D]" />
          <span className="text-sm text-navy">
            Acepto el tratamiento de mis datos según la <Link href="/privacidad" target="_blank" className="font-semibold underline underline-offset-2">política de privacidad</Link>.
          </span>
        </label>
        {fe.consent && <p id="join-consent-err" className="mt-1 text-sm font-medium text-bad">{fe.consent}</p>}
      </div>
      <Submit>Unirme a la tarjeta</Submit>
    </form>
  );
}
