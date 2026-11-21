'use client';

import { useId, useRef, useState } from 'react';
import { btnClass, inputClass } from '@/components/ui';
import type { AccessTokenKind } from '@/lib/contracts';
import { shareWhatsappUrl } from '@/lib/urls';
import type { EmailStatus } from './helpers';

const EMAIL_NOTE: Record<EmailStatus, { text: string; cls: string }> = {
  sent: { text: 'Te enviamos el enlace por correo.', cls: 'bg-[#DDF3E8] text-[#12683F]' },
  preview: { text: 'Modo de prueba: el correo no se envió. Comparte el enlace.', cls: 'bg-[#FFF3CC] text-[#7A5A00]' },
  failed: { text: 'No pudimos enviar el correo. Comparte el enlace.', cls: 'bg-[#FBE0DE] text-[#9B2A22]' }
};

/** Enlace de acceso recién emitido: "Copiar enlace" (con respaldo de campo seleccionable) y "Enviar por WhatsApp". */
export function AccessLinkPanel({ url, kind, shareText, emailStatus, to }: {
  url: string; kind: AccessTokenKind; shareText: string; emailStatus: EmailStatus; to: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null);
  const note = EMAIL_NOTE[emailStatus];

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopied('manual');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className={'rounded-xl px-3.5 py-3 text-sm leading-snug ' + note.cls}>
        {emailStatus === 'sent' ? <>Te enviamos el enlace a <strong className="font-semibold">{to}</strong>.</> : note.text}
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted">
          {kind === 'invite' ? 'Enlace de invitación (vence en 72 horas)' : 'Enlace para cambiar la contraseña (vence en 60 minutos)'}
        </label>
        <input
          ref={inputRef} id={id} readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          className={inputClass + ' font-mono text-[13px]'} spellCheck={false}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={copy} className={btnClass('primary') + ' h-12 sm:flex-1'}>
          {copied === 'ok' ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <a href={shareWhatsappUrl(shareText)} target="_blank" rel="noopener noreferrer" className={btnClass('dark') + ' h-12 sm:flex-1'}>
          Enviar por WhatsApp
        </a>
      </div>
      <p aria-live="polite" className="min-h-[1.1rem] text-[13px] text-muted">
        {copied === 'manual' ? 'Seleccionamos el enlace: cópialo con Ctrl+C o mantén presionado.' : copied === 'ok' ? 'Listo, pégalo donde quieras.' : ''}
      </p>
      <p className="text-xs text-muted">Por seguridad, este enlace solo se muestra ahora. Si lo pierdes, genera uno nuevo con &quot;Reenviar acceso&quot;.</p>
    </div>
  );
}
