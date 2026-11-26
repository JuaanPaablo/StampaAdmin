'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { btnClass, inputClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { OFFER_DESCRIPTION_MAX, OFFER_MAX_DAYS, OFFER_TERMS_MAX, OFFER_TITLE_MAX } from '@/lib/domain/wallet-cards';
import { createOfferAction, updateOfferAction, type OfferActionResult } from '@/app/panel/cupones/actions';
import { daysInclusive, resolveEndDay, validityLabel, type OfferFormField, type OfferFormValues } from './offer-form';
import { OfferPreview } from './OfferPreview';

export interface OfferBrand { businessName: string; logoText: string; logoUrl?: string; colors: { bg: string; accent: string; ink: string } }

/** Crear o editar un cupón (borrador) con vista previa en vivo. */
export function OfferForm({ offerId, defaults, brand, today }: { offerId?: string; defaults: OfferFormValues; brand: OfferBrand; today: string }) {
  const router = useRouter();
  const uid = useId();
  const [v, setV] = useState<OfferFormValues>(defaults);
  const [res, setRes] = useState<OfferActionResult | null>(null);
  const [pending, start] = useTransition();
  const errors = (res?.fieldErrors ?? {}) as Partial<Record<OfferFormField, string>>;
  const set = <K extends keyof OfferFormValues>(k: K, value: OfferFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const endDay = resolveEndDay(v);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = offerId ? await updateOfferAction(fd) : await createOfferAction(fd);
      setRes(r);
      if (r.ok && !offerId && r.offerId) router.push(`/panel/cupones/${r.offerId}?creado=1`);
      else if (r.ok) router.refresh();
      else {
        const first = Object.keys(r.fieldErrors ?? {})[0];
        if (first) document.getElementById(`${uid}-${first}`)?.focus();
      }
    });
  }

  const field = (name: OfferFormField, label: string, control: ReactNode, hint?: string) => {
    const id = `${uid}-${name}`;
    const err = errors[name];
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted">{label}</label>
        {control}
        {err ? <p id={`${id}-msg`} className="text-xs text-bad" role="alert">{err}</p> : hint ? <p id={`${id}-msg`} className="text-xs text-muted">{hint}</p> : null}
      </div>
    );
  };
  const aria = (name: OfferFormField, hasHint = true) => ({
    id: `${uid}-${name}`, name, 'aria-invalid': !!errors[name] || undefined,
    'aria-describedby': errors[name] || hasHint ? `${uid}-${name}-msg` : undefined
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {offerId && <input type="hidden" name="id" value={offerId} />}
        {field('title', 'Título', (
          <input {...aria('title')} value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={OFFER_TITLE_MAX} required placeholder="Ej. 2x1 en capuchinos" className={inputClass} />
        ), `${v.title.trim().length} de ${OFFER_TITLE_MAX} letras. Corto y claro: es lo que se lee primero.`)}
        {field('description', 'Qué incluye', (
          <textarea {...aria('description')} value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={OFFER_DESCRIPTION_MAX} required rows={3} placeholder="Ej. Trae a un amigo y llévense dos capuchinos por el precio de uno." className={cn(inputClass, 'h-auto min-h-24 py-2.5')} />
        ), `${v.description.trim().length} de ${OFFER_DESCRIPTION_MAX} letras.`)}

        <fieldset className="rounded-xl bg-surface p-4">
          <legend className="sr-only">Vigencia</legend>
          <p className="text-sm font-semibold text-navy" aria-hidden="true">¿Cuándo vale?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {field('startDay', 'Desde', (
              <input {...aria('startDay', false)} type="date" value={v.startDay} min={today} onChange={(e) => set('startDay', e.target.value)} required className={inputClass} />
            ))}
            <div className="flex flex-col gap-1.5">
              <span id={`${uid}-mode-l`} className="text-xs font-semibold tracking-wide text-muted">Cómo quieres elegir el final</span>
              <div role="radiogroup" aria-labelledby={`${uid}-mode-l`} className="grid grid-cols-2 gap-2">
                {([['days', 'Por días'], ['end', 'Por fecha']] as const).map(([m, label]) => (
                  <label key={m} className={cn('flex h-11 cursor-pointer items-center justify-center rounded-xl border-[1.5px] text-sm font-semibold focus-within:ring-4 focus-within:ring-sun/50',
                    v.mode === m ? 'border-navy bg-navy text-white' : 'border-[#C9D6E3] bg-white text-navy')}>
                    <input type="radio" name="mode" value={m} checked={v.mode === m} onChange={() => {
                      // Al cambiar de modo se mantiene el mismo día final.
                      setV((p) => ({
                        ...p, mode: m,
                        ...(m === 'end' && endDay ? { endDay } : {}),
                        ...(m === 'days' && endDay && endDay >= p.startDay ? { days: String(daysInclusive(p.startDay, endDay)) } : {})
                      }));
                    }} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {v.mode === 'days'
              ? field('days', 'Cuántos días dura', (
                <input {...aria('days')} type="number" inputMode="numeric" min={1} max={OFFER_MAX_DAYS} value={v.days} onChange={(e) => set('days', e.target.value)} required className={inputClass} />
              ), 'Contando el primer día.')
              : field('endDay', 'Hasta (incluido)', (
                <input {...aria('endDay', false)} type="date" value={v.endDay} min={v.startDay || today} onChange={(e) => set('endDay', e.target.value)} required className={inputClass} />
              ))}
            <p className="self-end pb-3 text-sm font-medium text-navy" aria-live="polite">{validityLabel(v.startDay, endDay)}</p>
          </div>
          {v.mode === 'days' && <input type="hidden" name="endDay" value="" />}
          {v.mode === 'end' && <input type="hidden" name="days" value="" />}
        </fieldset>

        <details className="rounded-xl ring-1 ring-line" open={!!(v.terms || v.imageUrl || errors.terms || errors.imageUrl)}>
          <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun/60">Condiciones e imagen (opcional)</summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            {field('terms', 'Condiciones', (
              <textarea {...aria('terms')} value={v.terms} onChange={(e) => set('terms', e.target.value)} maxLength={OFFER_TERMS_MAX} rows={2} placeholder="Ej. Válido de lunes a jueves. No acumulable con otras promociones." className={cn(inputClass, 'h-auto min-h-20 py-2.5')} />
            ), `${v.terms.trim().length} de ${OFFER_TERMS_MAX} letras.`)}
            {field('imageUrl', 'Enlace de una imagen', (
              <input {...aria('imageUrl')} type="url" inputMode="url" value={v.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" className={inputClass} />
            ), 'Pega el enlace de una foto que ya esté en internet (debe empezar con https).')}
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={btnClass('primary')}>{pending ? 'Guardando…' : offerId ? 'Guardar cambios' : 'Guardar borrador'}</button>
          <p role="status" aria-live="polite" className={cn('text-sm', res?.ok ? 'text-good' : 'text-bad')}>
            {res ? (res.ok ? res.message ?? 'Listo.' : res.error ?? (res.fieldErrors ? 'Revisa los campos marcados.' : '')) : ''}
          </p>
        </div>
        {!offerId && <p className="text-xs text-muted">Guardar no lo envía. Lo revisas y después lo envías a tus clientes.</p>}
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <OfferPreview {...brand} title={v.title.trim()} description={v.description.trim()} terms={v.terms.trim() || undefined}
          imageUrl={v.imageUrl.trim() || undefined} validity={validityLabel(v.startDay, endDay)} />
      </div>
    </div>
  );
}
