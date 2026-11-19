'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { BUSINESS_TYPES, getTemplate } from '@/lib/templates';
import type { BusinessType } from '@/lib/contracts';
import { Field, Input, btnClass } from '@/components/ui';
import { money } from '@/lib/format';
import { createBusinessAction } from './actions';
import { detailsSchema, fieldErrors, type Details } from './schema';

type Errors = Record<string, string>;
const STEPS = ['Tipo de negocio', 'Tus datos', 'Vista previa'];

function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? 'S') + (w[1]?.[0] ?? '')).toUpperCase();
}

export function RegistroWizard({ initialType }: { initialType?: BusinessType }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<BusinessType | undefined>(initialType);
  const [d, setD] = useState<Details>({ name: '', city: '', ownerName: '', pin: '', pin2: '', consent: false as unknown as true });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const set = <K extends keyof Details>(k: K, v: Details[K]) => { setD((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: '' })); };
  const template = type ? getTemplate(type) : undefined;

  function next1() {
    if (!type) { setErrors({ type: 'Elige el tipo de negocio para continuar.' }); return; }
    setErrors({}); setStep(2);
  }
  function next2() {
    const r = detailsSchema.safeParse(d);
    if (!r.success) { setErrors(fieldErrors(r.error)); return; }
    setErrors({}); setStep(3);
  }
  function create() {
    if (!type) return;
    setFormError(undefined);
    start(async () => {
      const r = await createBusinessAction({ type, details: d });
      if (r.ok) { router.push(r.redirectTo); router.refresh(); return; }
      if (r.fieldErrors) {
        setErrors(r.fieldErrors);
        setStep(r.fieldErrors.type ? 1 : 2);
      }
      setFormError(r.error ?? 'Revisa los datos marcados.');
    });
  }

  return (
    <div>
      <ol className="mb-6 flex gap-2" aria-label="Pasos del registro">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className="flex flex-1 flex-col gap-1.5">
            <span className={'h-1.5 rounded-full ' + (step >= i + 1 ? 'bg-navy' : 'bg-[#C9D6E3]')} />
            <span className={'text-xs ' + (step === i + 1 ? 'font-semibold text-navy' : 'text-muted')}>
              <span className="sr-only">Paso </span>{i + 1}<span className="hidden sm:inline">. {s}</span>
              <span className="sr-only sm:hidden">: {s}</span>
            </span>
          </li>
        ))}
      </ol>

      {formError && <p role="alert" className="mb-4 rounded-xl bg-[#FBE0DE] px-4 py-3 text-sm text-[#9B2A22]">{formError}</p>}

      {step === 1 && (
        <section aria-labelledby="paso-1">
          <h1 id="paso-1" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold tracking-tight text-navy focus:outline-none sm:text-[28px]">¿Qué tipo de negocio tienes?</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Con esto dejamos lista tu tarjeta de sellos: el premio, los sellos necesarios y las palabras que verá tu equipo. Todo se puede cambiar después.</p>
          <fieldset className="mt-6">
            <legend className="sr-only">Tipo de negocio</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BUSINESS_TYPES.map((t) => {
                const selected = type === t.type;
                return (
                  <label key={t.type} className={'group relative flex cursor-pointer flex-col gap-2 rounded-2xl bg-white p-4 shadow-card ring-2 transition focus-within:ring-sun ' + (selected ? 'ring-navy' : 'ring-transparent hover:ring-[#C9D6E3]')}>
                    <input type="radio" name="tipo" value={t.type} checked={selected} onChange={() => { setType(t.type); setErrors({}); }} className="sr-only" />
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-display text-base font-bold text-navy">{t.label}</span>
                      <span aria-hidden="true" className={'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ' + (selected ? 'border-navy bg-navy' : 'border-[#C9D6E3]')}>
                        {selected && <span className="h-2 w-2 rounded-full bg-sun" />}
                      </span>
                    </span>
                    <span className="text-sm text-muted">{t.tagline}</span>
                    <span className="mt-1 space-y-0.5 border-t border-line pt-2 text-[13px] text-navy">
                      <span className="block">Premio de ejemplo: <strong>{t.program.rewardTitle}</strong></span>
                      <span className="block">{t.program.stampsRequired} sellos para ganarlo</span>
                      <span className="block text-muted">Tu equipo verá «{t.vocab.counter}» y a tus clientes como {t.vocab.customers}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.type && <p className="mt-3 text-sm text-bad" role="alert">{errors.type}</p>}
          </fieldset>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={next1} className={btnClass('primary')}>Continuar</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="paso-2" className="mx-auto max-w-xl">
          <h1 id="paso-2" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold tracking-tight text-navy focus:outline-none sm:text-[28px]">Cuéntanos de tu negocio</h1>
          <p className="mt-1 text-sm text-muted">Tu PIN te servirá para ingresar al panel. No lo compartas.</p>
          <form noValidate onSubmit={(e) => { e.preventDefault(); next2(); }} className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line/70 sm:p-6">
            <Field label="Nombre del negocio" htmlFor="r-name" error={errors.name}>
              <Input id="r-name" name="name" value={d.name} onChange={(e) => set('name', e.target.value)} autoComplete="organization" aria-invalid={!!errors.name} maxLength={60} />
            </Field>
            <Field label="Ciudad (opcional)" htmlFor="r-city" error={errors.city}>
              <Input id="r-city" name="city" value={d.city ?? ''} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" aria-invalid={!!errors.city} maxLength={60} />
            </Field>
            <Field label="Tu nombre (dueño o dueña)" htmlFor="r-owner" error={errors.ownerName}>
              <Input id="r-owner" name="ownerName" value={d.ownerName} onChange={(e) => set('ownerName', e.target.value)} autoComplete="name" aria-invalid={!!errors.ownerName} maxLength={60} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="PIN de 4 dígitos" htmlFor="r-pin" error={errors.pin}>
                <Input id="r-pin" name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={d.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))} aria-invalid={!!errors.pin} />
              </Field>
              <Field label="Repite el PIN" htmlFor="r-pin2" error={errors.pin2}>
                <Input id="r-pin2" name="pin2" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={d.pin2} onChange={(e) => set('pin2', e.target.value.replace(/\D/g, '').slice(0, 4))} aria-invalid={!!errors.pin2} />
              </Field>
            </div>
            <div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-navy">
                <input type="checkbox" checked={!!d.consent} onChange={(e) => set('consent', e.target.checked as unknown as true)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'r-consent-err' : undefined} className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#C9D6E3] accent-[#001D3D]" />
                <span>Entiendo que Stampa guardará los datos de mis clientes (nombre, contacto, cumpleaños si lo dan y su consentimiento) y que mi negocio es responsable de usarlos solo con su consentimiento.</span>
              </label>
              {errors.consent && <p id="r-consent-err" className="mt-1.5 text-xs text-bad" role="alert">{errors.consent}</p>}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className={btnClass('ghost')}>Atrás</button>
              <button type="submit" className={btnClass('primary')}>Continuar</button>
            </div>
          </form>
        </section>
      )}

      {step === 3 && template && (
        <section aria-labelledby="paso-3" className="mx-auto max-w-xl">
          <h1 id="paso-3" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold tracking-tight text-navy focus:outline-none sm:text-[28px]">Así se verá tu tarjeta</h1>
          <p className="mt-1 text-sm text-muted">Empiezas con los valores sugeridos para {template.label.toLowerCase()}. Después los puedes cambiar en Tarjeta.</p>

          <div className="mt-6 overflow-hidden rounded-3xl p-5 shadow-card" style={{ background: template.program.colors.bg, color: template.program.colors.ink }} role="img" aria-label={`Vista previa de la tarjeta ${template.program.name} con ${template.program.stampsRequired} sellos y premio ${template.program.rewardTitle}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold" style={{ background: template.program.colors.accent, color: template.program.colors.bg }}>{initials(d.name)}</span>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold">{d.name.trim() || 'Tu negocio'}</p>
                <p className="text-xs opacity-75">{template.program.name}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2" aria-hidden="true">
              {Array.from({ length: template.program.stampsRequired }, (_, i) => (
                <span key={i} className="aspect-square rounded-full border-2 border-dashed" style={{ borderColor: template.program.colors.accent, opacity: 0.85 }} />
              ))}
            </div>
            <p className="mt-5 text-sm"><span className="opacity-75">Premio: </span><strong>{template.program.rewardTitle}</strong> a los {template.program.stampsRequired} sellos</p>
          </div>

          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white p-5 text-sm shadow-card ring-1 ring-line/70">
            <dt className="text-muted">Negocio</dt><dd className="font-medium text-navy">{d.name.trim()}</dd>
            <dt className="text-muted">Tipo</dt><dd className="font-medium text-navy">{template.label}</dd>
            {d.city?.trim() && (<><dt className="text-muted">Ciudad</dt><dd className="font-medium text-navy">{d.city.trim()}</dd></>)}
            <dt className="text-muted">Dueño</dt><dd className="font-medium text-navy">{d.ownerName.trim()}</dd>
            <dt className="text-muted">Sello por</dt>
            <dd className="font-medium text-navy">{template.program.requireAmount ? `cada ${money(template.program.minSpendCentsPerStamp)} de consumo` : `cada ${template.vocab.visit}`}</dd>
          </dl>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(2)} className={btnClass('ghost')} disabled={pending}>Atrás</button>
            <button type="button" onClick={create} disabled={pending} className={btnClass('primary')}>{pending ? 'Creando…' : 'Crear mi negocio'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
