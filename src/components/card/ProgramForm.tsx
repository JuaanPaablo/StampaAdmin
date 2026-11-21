'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useFormState } from 'react-dom';
import { saveProgram } from '@/app/panel/tarjeta/actions';
import { Card, Input, Textarea, Select } from '@/components/ui';
import type { Program } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';
import { money, parseMoney } from '@/lib/format';
import { CardPreview } from './CardPreview';
import { ContrastHint } from './ContrastHint';
import { FormField, Switch, describedBy } from './FormField';
import { SubmitButton } from './SubmitButton';
import { PALETTES, contrastRatio, normalizeHex } from './contrast';
import type { ProgramFormState } from './schema';
import { COOLDOWN_OPTIONS, TTL_OPTIONS } from './schema';
import { cooldownLabel, describeChanges, ttlLabel, valuesFromProgram, type FormValues } from './values';

export interface ProgramFormProps {
  program: Program;
  businessName: string;
  vocab: Vocabulary;
  rewardIdeas: string[];
  templateColors: { bg: string; accent: string; ink: string };
  /** Acción que guarda. Por defecto la del editor de tarjeta (todo el programa). */
  action?: (prev: ProgramFormState, fd: FormData) => Promise<ProgramFormState>;
  /**
   * Paso del asistente de bienvenida: muestra solo una parte del formulario y un botón "Guardar y seguir".
   * 'colores' = colores de la tarjeta · 'tarjeta' = sellos, premio, monto mínimo y regalo de cumpleaños.
   */
  wizardStep?: 'colores' | 'tarjeta';
  /** Bloque de imágenes (logo y portada). Va fuera del <form> porque sube por su cuenta. */
  imagesSlot?: ReactNode;
  /** Botones extra junto a "Guardar" (p. ej. "Atrás" en el asistente). */
  extraActions?: ReactNode;
  submitLabel?: string;
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <Card as="section" className="space-y-4">
      <div>
        <h2 id={id} className="font-display text-lg font-semibold text-navy">{title}</h2>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </Card>
  );
}

function ColorField({ id, name, label, value, onChange, error, describedExtra }: {
  id: string; name: string; label: string; value: string; onChange: (v: string) => void; error?: string; describedExtra?: string;
}) {
  const valid = normalizeHex(value);
  return (
    <FormField id={id} label={label} error={error ?? (valid ? undefined : 'Usa un color con formato #RRGGBB.')}>
      <div className="flex items-center gap-2">
        <input
          type="color" aria-label={`Elegir ${label.toLowerCase()}`} value={valid ?? '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border-[1.5px] border-[#C9D6E3] bg-white p-1"
        />
        <Input id={id} name={name} value={value} maxLength={7} spellCheck={false} autoComplete="off" className="font-mono uppercase"
          onChange={(e) => onChange(e.target.value)} aria-invalid={!valid} aria-describedby={describedBy(id, undefined, error ?? (valid ? undefined : 'x'), describedExtra)} />
      </div>
    </FormField>
  );
}

export function ProgramForm({ program, businessName, vocab, rewardIdeas, templateColors, action = saveProgram, wizardStep, imagesSlot, extraActions, submitLabel }: ProgramFormProps) {
  const [state, formAction] = useFormState<ProgramFormState, FormData>(action, { ok: false });
  const [v, setV] = useState<FormValues>(() => valuesFromProgram(program));
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = state.errors ?? {};
  const wizard = !!wizardStep;
  const show = {
    identidad: !wizard,
    premio: !wizard || wizardStep === 'tarjeta',
    premioExtra: !wizard,
    colores: !wizard || wizardStep === 'colores',
    reglas: !wizard,
    terminos: !wizard
  };

  const ticket = vocab.ticket.toLowerCase();
  const changes = useMemo(() => describeChanges(program, v, vocab), [program, v, vocab]);
  const ruleChanged = changes.some((c) => c.rule);

  const bg = normalizeHex(v.bg) ?? program.colors.bg;
  const accent = normalizeHex(v.accent) ?? program.colors.accent;
  const ink = normalizeHex(v.ink) ?? program.colors.ink;
  const inkRatio = contrastRatio(ink, bg);
  const accentRatio = contrastRatio(accent, bg);

  const palettes = [{ id: 'plantilla', name: 'Colores de tu plantilla', ...templateColors }, ...PALETTES.filter((p) => !(p.bg === templateColors.bg && p.accent === templateColors.accent && p.ink === templateColors.ink))];
  const spend = parseMoney(v.minSpend);
  const ttlOptions = Array.from(new Set<number>([...TTL_OPTIONS, v.codeTtlSeconds])).sort((a, b) => a - b);
  const cooldownOptions = Array.from(new Set<number>([...COOLDOWN_OPTIONS, v.cooldownMinutes])).sort((a, b) => a - b);

  /** Monto mínimo por sello: va en "Reglas de sellos" en el editor y dentro de "Tu premio" en el asistente. */
  const amountFields = (
    <>
      <Switch id="requireAmount" name="requireAmount" checked={v.requireAmount} onChange={(x) => set('requireAmount', x)}
        label="El sello depende del monto"
        help={v.requireAmount
          ? `Quien atiende escribe el monto del ${ticket} y el sistema calcula cuántos sellos da. Así nadie reparte sellos sin un comprobante.`
          : `Apagado: cada ${vocab.visit} da un sello, sin importar cuánto se gaste. El control se apoya en los cupos y en el tiempo mínimo entre sellos.`} />

      {v.requireAmount ? (
        <FormField id="minSpend" label="Mínimo por sello (USD)" error={err.minSpend}
          help={spend > 0
            ? `Cada ${money(spend)} de consumo da un sello. Con un ${ticket} de $10,00 se dan ${Math.floor(1000 / spend)} sellos.`
            : `Cuánto debe consumir tu ${vocab.customer} para ganar un sello.`}>
          <div className="relative max-w-[180px]">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted" aria-hidden="true">$</span>
            <Input id="minSpend" name="minSpend" inputMode="decimal" value={v.minSpend} onChange={(e) => set('minSpend', e.target.value.replace(/[^0-9.,]/g, ''))}
              className="pl-7" aria-invalid={!!err.minSpend} aria-describedby={describedBy('minSpend', 'x', err.minSpend)} />
          </div>
        </FormField>
      ) : <input type="hidden" name="minSpend" value={v.minSpend} />}
    </>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <aside aria-label="Vista previa de la tarjeta" className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
        <CardPreview data={{
          businessName, programName: v.name, stampsRequired: v.stampsRequired, rewardTitle: v.rewardTitle, bg: v.bg, accent: v.accent, ink: v.ink,
          logoText: v.logoText, logoUrl: program.logoUrl || undefined, coverUrl: program.coverUrl || undefined
        }} />
      </aside>

      <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
        {imagesSlot}
        <form action={formAction} className="min-w-0 space-y-5" noValidate>
          {show.identidad && (
            <Section id="sec-identidad" title="Identidad de la tarjeta" intro={`Lo primero que ve tu ${vocab.customer} al abrir su tarjeta.`}>
              <FormField id="name" label="Nombre de la tarjeta" error={err.name}>
                <Input id="name" name="name" value={v.name} maxLength={40} required onChange={(e) => set('name', e.target.value)} aria-invalid={!!err.name} aria-describedby={describedBy('name', undefined, err.name)} />
              </FormField>
              <FormField id="logoText" label="Iniciales" help="De 1 a 3 letras. Se ven en lugar del logo si no subes uno." error={err.logoText} className="max-w-[260px]">
                <Input id="logoText" name="logoText" value={v.logoText} maxLength={3} required className="uppercase" autoComplete="off"
                  onChange={(e) => set('logoText', e.target.value.toUpperCase())} aria-invalid={!!err.logoText} aria-describedby={describedBy('logoText', 'x', err.logoText)} />
              </FormField>
            </Section>
          )}

          {show.premio && (
            <Section id="sec-premio" title={wizard ? 'Tu premio' : 'Premio'} intro={`Qué gana tu ${vocab.customer} al completar la tarjeta.`}>
              <FormField id="stampsRequired" label="Sellos para ganar el premio" error={err.stampsRequired}
                help={`Tu ${vocab.customer} necesitará ${v.stampsRequired} ${vocab.visits} para completar la tarjeta. Entre 4 y 20.`}>
                <div className="flex items-center gap-4">
                  <input id="stampsRequired" name="stampsRequired" type="range" min={4} max={20} step={1} value={v.stampsRequired}
                    onChange={(e) => set('stampsRequired', Number(e.target.value))} className="h-11 w-full accent-[#001D3D]"
                    aria-describedby={describedBy('stampsRequired', 'x', err.stampsRequired)} />
                  <output htmlFor="stampsRequired" className="w-12 shrink-0 rounded-xl bg-surface py-2 text-center font-display text-lg font-bold tabular-nums text-navy">{v.stampsRequired}</output>
                </div>
              </FormField>
              <FormField id="rewardTitle" label="Título del premio" error={err.rewardTitle}>
                <Input id="rewardTitle" name="rewardTitle" value={v.rewardTitle} maxLength={50} required onChange={(e) => set('rewardTitle', e.target.value)}
                  aria-invalid={!!err.rewardTitle} aria-describedby={describedBy('rewardTitle', undefined, err.rewardTitle, rewardIdeas.length ? 'rewardTitle-ideas' : undefined)} />
                {rewardIdeas.length > 0 && (
                  <div id="rewardTitle-ideas" role="group" aria-label="Ideas de premio" className="flex flex-wrap gap-2 pt-1">
                    {rewardIdeas.map((idea) => (
                      <button key={idea} type="button" aria-pressed={v.rewardTitle === idea} onClick={() => set('rewardTitle', idea)}
                        className={'rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ' + (v.rewardTitle === idea ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
                        {idea}
                      </button>
                    ))}
                  </div>
                )}
              </FormField>
              {show.premioExtra && (
                <FormField id="rewardDescription" label="Descripción del premio" optional error={err.rewardDescription}>
                  <Input id="rewardDescription" name="rewardDescription" value={v.rewardDescription} maxLength={120} onChange={(e) => set('rewardDescription', e.target.value)}
                    aria-invalid={!!err.rewardDescription} aria-describedby={describedBy('rewardDescription', undefined, err.rewardDescription)} />
                </FormField>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {show.premioExtra && (
                  <FormField id="rewardExpiresDays" label="Vigencia del premio (días)" optional error={err.rewardExpiresDays}
                    help={`Días que tiene tu ${vocab.customer} para canjear el premio. Vacío: no vence.`}>
                    <Input id="rewardExpiresDays" name="rewardExpiresDays" inputMode="numeric" value={v.rewardExpiresDays} maxLength={3}
                      onChange={(e) => set('rewardExpiresDays', e.target.value.replace(/\D/g, ''))} aria-invalid={!!err.rewardExpiresDays} aria-describedby={describedBy('rewardExpiresDays', 'x', err.rewardExpiresDays)} />
                  </FormField>
                )}
                <FormField id="birthdayReward" label="Regalo de cumpleaños" optional error={err.birthdayReward} help="Se ofrece en la semana del cumpleaños.">
                  <Input id="birthdayReward" name="birthdayReward" value={v.birthdayReward} maxLength={80} onChange={(e) => set('birthdayReward', e.target.value)}
                    aria-invalid={!!err.birthdayReward} aria-describedby={describedBy('birthdayReward', 'x', err.birthdayReward)} />
                </FormField>
              </div>
              {wizard && amountFields}
            </Section>
          )}

          {show.colores && (
            <Section id="sec-colores" title={wizard ? 'Colores de tu tarjeta' : 'Colores'} intro="Elige una paleta o ajusta cada color. Revisa que el texto se lea bien.">
              <div role="group" aria-label="Paletas sugeridas" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {palettes.map((p) => {
                  const active = p.bg.toLowerCase() === bg.toLowerCase() && p.accent.toLowerCase() === accent.toLowerCase() && p.ink.toLowerCase() === ink.toLowerCase();
                  return (
                    <button key={p.id} type="button" aria-pressed={active}
                      onClick={() => setV((s) => ({ ...s, bg: p.bg, accent: p.accent, ink: p.ink }))}
                      className={'flex items-center gap-2 rounded-xl p-2 text-left text-xs font-semibold text-navy ring-1 ring-inset transition ' + (active ? 'bg-surface ring-2 ring-navy' : 'bg-white ring-[#C9D6E3] hover:bg-surface')}>
                      <span className="flex shrink-0 overflow-hidden rounded-full ring-1 ring-black/10" aria-hidden="true">
                        {[p.bg, p.accent, p.ink].map((c, i) => <span key={i} className="h-7 w-5" style={{ background: c }} />)}
                      </span>
                      <span className="min-w-0 leading-tight">{p.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField id="bg" name="bg" label="Fondo" value={v.bg} onChange={(x) => set('bg', x)} error={err.bg} describedExtra="contrast-ink contrast-accent" />
                <ColorField id="accent" name="accent" label="Acento" value={v.accent} onChange={(x) => set('accent', x)} error={err.accent} describedExtra="contrast-accent" />
                <ColorField id="ink" name="ink" label="Texto" value={v.ink} onChange={(x) => set('ink', x)} error={err.ink} describedExtra="contrast-ink" />
              </div>
              <div className="space-y-2 rounded-xl bg-surface p-3">
                <ContrastHint id="contrast-ink" label="Texto sobre el fondo" ratio={inkRatio} min={4.5} />
                <ContrastHint id="contrast-accent" label="Acento sobre el fondo" ratio={accentRatio} min={3} />
              </div>
            </Section>
          )}

          {show.reglas && (
            <Section id="sec-reglas" title="Reglas de sellos" intro="Controlan cómo se entregan los sellos y evitan que se repartan de más.">
              {amountFields}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="codeTtlSeconds" label="Vigencia del código" error={err.codeTtlSeconds}
                  help={`Tiempo que tiene tu ${vocab.customer} para escanear el código. Un código corto es difícil de pasar por mensaje a quien no está en el local.`}>
                  <Select id="codeTtlSeconds" name="codeTtlSeconds" value={v.codeTtlSeconds} onChange={(e) => set('codeTtlSeconds', Number(e.target.value))} aria-describedby={describedBy('codeTtlSeconds', 'x', err.codeTtlSeconds)}>
                    {ttlOptions.map((s) => <option key={s} value={s}>{ttlLabel(s)}</option>)}
                  </Select>
                </FormField>
                <FormField id="maxSeatsWithoutApproval" label="Cupos máximos sin aprobación" error={err.maxSeatsWithoutApproval}
                  help={`Si un ${ticket} reparte más cupos que este número, se pide el PIN de un dueño o gerente. Así nadie reparte sellos de más.`}>
                  <Select id="maxSeatsWithoutApproval" name="maxSeatsWithoutApproval" value={v.maxSeatsWithoutApproval} onChange={(e) => set('maxSeatsWithoutApproval', Number(e.target.value))} aria-describedby={describedBy('maxSeatsWithoutApproval', 'x', err.maxSeatsWithoutApproval)}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'cupo' : 'cupos'}</option>)}
                  </Select>
                </FormField>
              </div>
              <FormField id="cooldownMinutes" label={`Tiempo mínimo entre sellos del mismo ${vocab.customer}`} error={err.cooldownMinutes} className="max-w-md"
                help={`Cuánto debe esperar tu ${vocab.customer} para sumar otro sello. Evita que alguien junte varios sellos con una sola ${vocab.visit}.`}>
                <Select id="cooldownMinutes" name="cooldownMinutes" value={v.cooldownMinutes} onChange={(e) => set('cooldownMinutes', Number(e.target.value))} aria-describedby={describedBy('cooldownMinutes', 'x', err.cooldownMinutes)}>
                  {cooldownOptions.map((m) => <option key={m} value={m}>{cooldownLabel(m)}</option>)}
                </Select>
              </FormField>
            </Section>
          )}

          {show.terminos && (
            <Section id="sec-terminos" title="Términos y condiciones">
              <FormField id="terms" label="Condiciones del programa" optional error={err.terms} help={`Tu ${vocab.customer} las ve al crear su tarjeta. Máximo 600 caracteres.`}>
                <Textarea id="terms" name="terms" rows={4} value={v.terms} maxLength={600} onChange={(e) => set('terms', e.target.value)}
                  aria-invalid={!!err.terms} aria-describedby={describedBy('terms', 'x', err.terms)} />
              </FormField>
            </Section>
          )}

          {wizard ? (
            <div className="space-y-3">
              <div aria-live="polite" role="status" className="min-h-[1.25rem]">
                {state.message && !state.ok && <p className="text-sm font-medium text-bad">{state.message}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton>{submitLabel ?? 'Guardar y seguir'}</SubmitButton>
                {extraActions}
              </div>
            </div>
          ) : (
            <Card as="section" className="space-y-4">
              <div>
                <h2 id="sec-cambios" className="font-display text-lg font-semibold text-navy">Qué cambia</h2>
              </div>
              {changes.length === 0 ? (
                <p className="text-sm text-muted">Aún no hay cambios por guardar.</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {changes.map((c) => (
                      <li key={c.key} className="rounded-xl bg-surface px-3 py-2 text-sm">
                        <p className="text-navy"><strong>{c.label}:</strong> {c.from} <span aria-label="cambia a">→</span> <strong>{c.to}</strong></p>
                        {c.effect && <p className="mt-0.5 text-xs text-muted">{c.effect}</p>}
                      </li>
                    ))}
                  </ul>
                  {ruleChanged && <p className="text-xs text-muted">Las reglas nuevas se aplican a los códigos que se generen desde ahora. Los códigos ya creados no cambian.</p>}
                </>
              )}
              <div aria-live="polite" role="status" className="min-h-[1.25rem]">
                {state.message && (
                  <p className={'text-sm font-medium ' + (state.ok ? 'text-[#12683F]' : 'text-bad')}>{state.message}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton disabled={changes.length === 0}>Guardar cambios</SubmitButton>
                {changes.length === 0 && <span className="text-xs text-muted">El botón se activa cuando cambies algo.</span>}
              </div>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
