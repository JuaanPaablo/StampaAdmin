'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { sendInviteAction } from '@/app/panel/equipo/actions';
import { Badge, Card, Input, btnClass } from '@/components/ui';
import { FormField, describedBy } from '@/components/card/FormField';
import { SubmitButton } from '@/components/card/SubmitButton';
import { ACCESS_LABEL, ACCESS_TONE, type AccessStatus, type InviteState } from './schema';

/** Acceso al panel de una persona: estado, enviar o reenviar la invitación y compartir el enlace. Solo dueño. */
export function InviteCard({ staffId, name, email, status, active, isMe }: {
  staffId: string; name: string; email?: string; status: AccessStatus; active: boolean; isMe: boolean;
}) {
  const [state, action] = useFormState<InviteState, FormData>(sendInviteAction, { ok: false });
  const [copied, setCopied] = useState(false);
  const first = name.split(' ')[0];
  const canInvite = active && !isMe && status !== 'active';

  async function copy() {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card as="section" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">Acceso al panel</h2>
        <Badge tone={ACCESS_TONE[status]}>{ACCESS_LABEL[status]}</Badge>
      </div>

      {status === 'active' ? (
        <p className="text-sm text-muted">
          {isMe ? 'Entras con tu correo' : `${first} entra con su correo`} <span className="font-semibold text-navy">{email}</span> y su contraseña.
        </p>
      ) : !active ? (
        <p className="text-sm text-muted">Esta persona está desactivada. Actívala para invitarla.</p>
      ) : (
        <p className="text-sm text-muted">
          {status === 'pending'
            ? `Invitación enviada a ${email}. Reenviarla anula el enlace anterior.`
            : `Envía la invitación para que ${first} cree su contraseña.`}
        </p>
      )}

      {canInvite && (
        <form action={action} className="space-y-3" noValidate>
          <input type="hidden" name="id" value={staffId} />
          <FormField id="invite-email" label="Correo" error={state.ok ? undefined : state.error}>
            <Input id="invite-email" name="email" type="email" inputMode="email" defaultValue={email ?? ''} maxLength={254} required autoComplete="off"
              spellCheck={false} placeholder="nombre@correo.com" aria-invalid={!state.ok && !!state.error}
              aria-describedby={describedBy('invite-email', undefined, state.ok ? undefined : state.error)} />
          </FormField>
          <SubmitButton variant="dark" pendingText="Enviando…">{status === 'pending' ? 'Reenviar invitación' : 'Enviar invitación'}</SubmitButton>
        </form>
      )}
      {!canInvite && !state.ok && state.error && <p role="alert" className="text-sm font-medium text-bad">{state.error}</p>}

      <div aria-live="polite" role="status">
        {state.ok && state.url && (
          <div className="space-y-3 rounded-xl bg-surface p-4">
            <p className="text-sm font-medium text-navy">{state.message}</p>
            <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-navy ring-1 ring-inset ring-line">{state.url}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className={btnClass('ghost', 'sm')}>{copied ? 'Copiado' : 'Copiar enlace'}</button>
              {state.shareUrl && (
                <a href={state.shareUrl} target="_blank" rel="noopener noreferrer" className={btnClass('primary', 'sm')}>Enviar por WhatsApp</a>
              )}
            </div>
            <p className="text-xs text-muted">El enlace vence en 72 horas y sirve una sola vez.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
