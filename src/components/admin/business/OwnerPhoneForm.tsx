'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { btnClass, inputClass } from '@/components/ui';
import { setOwnerPhoneAction, type AdminActionResult } from '@/lib/admin-actions';
import { formatEcPhone, localEcPhone } from '@/lib/phone';
import { cn } from '@/lib/cn';

/**
 * Celular del dueño (WhatsApp). Muestra el número guardado y permite cambiarlo o borrarlo.
 * La validación real la hace el servidor (normalizeEcPhone); aquí solo se envía lo escrito.
 */
export function OwnerPhoneForm({ businessId, phone }: { businessId: string; phone?: string }) {
  const [editing, setEditing] = useState(!phone);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(localEcPhone(phone));
  const [pending, start] = useTransition();
  const [res, setRes] = useState<AdminActionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const error = res && !res.ok ? res.fieldErrors?.phone ?? res.error : undefined;

  function save(raw: string) {
    const fd = new FormData();
    fd.set('businessId', businessId);
    fd.set('phone', raw);
    start(async () => {
      const r = await setOwnerPhoneAction(fd);
      setRes(r);
      setConfirming(false);
      if (r.ok) {
        setEditing(false);
        if (!raw.trim()) setValue('');
        requestAnimationFrame(() => editRef.current?.focus());
      } else if (raw.trim()) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save(value);
  }

  function cancelDelete() {
    setConfirming(false);
    requestAnimationFrame(() => deleteRef.current?.focus());
  }

  function openEditor() {
    setRes(null);
    setConfirming(false);
    setValue(localEcPhone(phone));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const status = <p role="status" aria-live="polite" className={cn('min-h-[1.25rem] text-sm', res?.ok ? 'text-[#12683F]' : 'text-bad')}>{res ? (res.ok ? res.message : error) : ''}</p>;

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-navy">{phone ? formatEcPhone(phone) : <span className="text-muted">Sin celular</span>}</span>
          <button ref={editRef} type="button" onClick={openEditor} className={btnClass('ghost', 'sm')}>{phone ? 'Cambiar' : 'Agregar celular'}</button>
          {phone && !confirming && (
            <button ref={deleteRef} type="button" disabled={pending} onClick={() => { setRes(null); setConfirming(true); }} className={btnClass('danger', 'sm')}>
              Borrar
            </button>
          )}
        </div>
        {phone && confirming && (
          <div role="alertdialog" aria-labelledby={`phone-del-${businessId}`} onKeyDown={(e) => { if (e.key === 'Escape' && !pending) cancelDelete(); }}
            className="flex flex-col gap-3 rounded-xl bg-[#FBE9E7] p-4">
            <p id={`phone-del-${businessId}`} className="text-sm font-semibold text-navy">¿Borrar el celular {formatEcPhone(phone)}?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => save('')} disabled={pending} autoFocus className={btnClass('danger') + ' h-12'}>
                {pending ? 'Borrando…' : 'Sí, borrar'}
              </button>
              <button type="button" onClick={cancelDelete} disabled={pending} className={btnClass('ghost') + ' h-12'}>Cancelar</button>
            </div>
          </div>
        )}
        {status}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={`phone-${businessId}`} className="text-xs font-semibold tracking-wide text-muted">Celular del dueño (WhatsApp)</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef} id={`phone-${businessId}`} name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={30}
          placeholder="09XXXXXXXX" value={value} onChange={(e) => { setValue(e.currentTarget.value); if (res && !res.ok) setRes(null); }}
          aria-invalid={!!error} aria-describedby={`phone-${businessId}-msg`}
          className={cn(inputClass, 'h-12 min-w-0 sm:flex-1', error && 'border-bad')}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={btnClass('dark') + ' h-12 flex-1 sm:flex-none'}>{pending ? 'Guardando…' : 'Guardar'}</button>
          {phone && (
            <button type="button" disabled={pending} onClick={() => { setEditing(false); setRes(null); requestAnimationFrame(() => editRef.current?.focus()); }}
              className={btnClass('ghost') + ' h-12 flex-1 sm:flex-none'}>Cancelar</button>
          )}
        </div>
      </div>
      <p id={`phone-${businessId}-msg`} className={cn('text-xs', error ? 'text-bad' : 'text-muted')} aria-live="polite">
        {error ?? 'Formato 09XXXXXXXX. Solo celulares de Ecuador.'}
      </p>
    </form>
  );
}
