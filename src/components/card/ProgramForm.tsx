'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useFormState } from 'react-dom';
import { saveProgram } from '@/app/panel/tarjeta/actions';
import { Card, Input, Textarea, Select } from '@/components/ui';
import type { Milestone, Program } from '@/lib/contracts';
import { MAX_MILESTONES, validateMilestones } from '@/lib/rewards';
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
  /** Premios intermedios que permite el plan. */
  maxMilestones?: number;
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

/** Premio solo al final, o también premios en el camino (de menos a más). */
function MilestonesField({ value, onChange, total, rewardTitle, error, max = MAX_MILESTONES }: {
  value: Milestone[]; onChange: (v: Milestone[]) => void; total: number; rewardTitle: string; error?: string; max?: number;
}) {
  const [mode, setMode] = useState<'final' | 'camino'>(value.length ? 'camino' : 'final');
  const live = mode === 'camino' ? value : [];
  const localErr = mode === 'camino' && value.length ? validateMilestones(value, total, max) : null;
  const shownErr = error ?? localErr ?? undefined;
  const free = (skip?: number) => Array.from({ length: total - 1 }, (_, i) => i + 1).filter((n) => n === skip || !value.some((m) => m.at === n));
  const add = () => {
    const used = new Set(value.map((m) => m.at));
    const guess = [Math.round(total / 2), Math.round(total / 3), Math.round((2 * total) / 3), 1].find((n) => n >= 1 && n < total && !used.has(n)) ?? free()[0];
    if (guess) onChange([...value, { at: guess, title: '' }]);
  };
  const pick = (m: 'final' | 'camino') => { setMode(m); if (m === 'camino' && value.length === 0) add(); };
  return (
    <fieldset className="space-y-3" aria-describedby={shownErr ? 'milestones-err' : undefined}>
      <legend className="text-xs font-semibold tracking-wide text-muted">¿Cuándo das premios?</legend>
      <input type="hidden" name="milestones" value={JSON.stringify(live.map((m) => ({ at: m.at, title: m.title.trim() })))} />
      <div className="grid gap-2 sm:grid-cols-2">
        {([['final', 'Solo al completar', `Un premio en el sello ${total}.`], ['camino', 'También en el camino', 'Premios que van de menos a más.']] as const).map(([id, title, text]) => (
          <label key={id} className={'cursor-pointer rounded-xl p-3 ring-1 ring-inset transition focus-within:ring-2 focus-within:ring-navy ' + (mode === id ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3] hover:bg-surface')}>
            <input type="radio" name="milestonesMode" value={id} checked={mode === id} onChange={() => pick(id)} className="sr-only" />
            <span className="block font-display text-sm font-semibold">{title}</span>
            <span className={'mt-0.5 block text-xs ' + (mode === id ? 'text-white/75' : 'text-muted')}>{text}</span>
          </label>
        ))}
      </div>
      {mode === 'camino' && (
        <div className="space-y-2 rounded-xl bg-surface p-3">
          {value.map((m, i) => (
            <div key={i} className="grid grid-cols-[128px_minmax(0,1fr)_auto] items-center gap-2">
              <Select aria-label={`Sello del premio ${i + 1}`} value={m.at} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, at: Number(e.target.value) } : x)))}>
                {free(m.at).map((n) => <option key={n} value={n}>Sello {n}</option>)}
              </Select>
              <Input aria-label={`Premio del sello ${m.at}`} value={m.title} maxLength={50} placeholder="Ej. Postre gratis"
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <button type="button" onClick={() => { const next = value.filter((_, j) => j !== i); onChange(next); if (!next.length) setMode('final'); }}
                className="h-11 rounded-xl px-3 text-xs font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-white" aria-label={`Quitar el premio del sello ${m.at}`}>Quitar</button>
            </div>
          ))}
          <div className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-2 text-sm">
            <span className="px-1 font-semibold text-navy">Sello {total}</span>
            <span className="truncate text-navy">{rewardTitle || 'Tu premio final'} <span className="text-muted">(final)</span></span>
          </div>
          {value.length < max && value.length < total - 1 && (
            <button type="button" onClick={add} className="text-sm font-semibold text-navy underline underline-offset-4">+ Agregar otro premio</button>
          )}
          {value.length >= max && max < MAX_MILESTONES && (
            <p className="text-xs text-muted">Tu plan: {max} {max === 1 ? 'premio' : 'premios'} antes del final. Standard o Pro: hasta {MAX_MILESTONES}.</p>
          )}
        </div>
      )}
      {shownErr && <p id="milestones-err" role="alert" className="text-xs font-medium text-bad">{shownErr}</p>}
    </fieldset>
  );
}

export function ProgramForm({ program, maxMilestones, businessName, vocab, rewardIdeas, templateColors, action = saveProgram, wizardStep, imagesSlot, extraActions, submitLabel }: ProgramFormProps) {
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
          ? `Se escribe el monto del ${ticket} y se calculan los sellos.`
          : `Cada ${vocab.visit} da un sello, sin importar el monto.`} />

      {v.requireAmount ? (
        <FormField id="minSpend" label="Mínimo por sello (USD)" error={err.minSpend}
          help={spend > 0
            ? `Ej.: un ${ticket} de $10,00 da ${Math.floor(1000 / spend)} sellos.`
            : undefined}>
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
          logoText: v.logoText, logoUrl: program.logoUrl || undefined, coverUrl: program.coverUrl || undefined,
          milestones: v.milestones, logoFraming: program.imageFraming?.logo, coverFraming: program.imageFraming?.cover
        }} />
      </aside>

      <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
        {imagesSlot}
        <form action={formAction} className="min-w-0 space-y-5" noValidate>
          {show.identidad && (
            <Section id="sec-identidad" title="Identidad de la tarjeta">
              <FormField id="name" label="Nombre de la tarjeta" error={err.name}>
                <Input id="name" name="name" value={v.name} maxLength={40} required onChange={(e) => set('name', e.target.value)} aria-invalid={!!err.name} aria-describedby={describedBy('name', undefined, err.name)} />
              </FormField>
              <FormField id="logoText" label="Iniciales" help="Se ven si no subes logo." error={err.logoText} className="max-w-[260px]">
                <Input id="logoText" name="logoText" value={v.logoText} maxLength={3} required className="uppercase" autoComplete="off"
                  onChange={(e) => set('logoText', e.target.value.toUpperCase())} aria-invalid={!!err.logoText} aria-describedby={describedBy('logoText', 'x', err.logoText)} />
              </FormField>
            </Section>
          )}

          {show.premio && (
            <Section id="sec-premio" title={wizard ? 'Tu premio' : 'Premio'}>
              <FormField id="stampsRequired" label="Sellos para ganar el premio" error={err.stampsRequired}
                help="Entre 4 y 20.">
                <div className="flex items-center gap-4">
                  <input id="stampsRequired" name="stampsRequired" type="range" min={4} max={20} step={1} value={v.stampsRequired}
                    onChange={(e) => set('stampsRequired', Number(e.target.value))} className="h-11 w-full accent-[#001D3D]"
                    aria-describedby={describedBy('stampsRequired', 'x', err.stampsRequired)} />
                  <output htmlFor="stampsRequired" className="w-12 shrink-0 rounded-xl bg-surface py-2 text-center font-display text-lg font-bold tabular-nums text-navy">{v.stampsRequired}</output>
                </div>
              </FormField>
              <FormField id="rewardTitle" label="Premio final" error={err.rewardTitle}>
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
              <MilestonesField value={v.milestones} onChange={(x) => set('milestones', x)} total={v.stampsRequired} rewardTitle={v.rewardTitle} error={err.milestones} max={maxMilestones} />
              {show.premioExtra && (
                <FormField id="rewardDescription" label="Descripción del premio" optional error={err.rewardDescription}>
                  <Input id="rewardDescription" name="rewardDescription" value={v.rewardDescription} maxLength={120} onChange={(e) => set('rewardDescription', e.target.value)}
                    aria-invalid={!!err.rewardDescription} aria-describedby={describedBy('rewardDescription', undefined, err.rewardDescription)} />
                </FormField>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {show.premioExtra && (
                  <FormField id="rewardExpiresDays" label="Vigencia del premio (días)" optional error={err.rewardExpiresDays}
                    help="Vacío: no vence.">
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
            <Section id="sec-colores" title={wizard ? 'Colores de tu tarjeta' : 'Colores'}>
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
            <Section id="sec-reglas" title="Reglas de sellos">
              {amountFields}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="codeTtlSeconds" label="Vigencia del código" error={err.codeTtlSeconds}
                  help="Más corto, más difícil de compartir fuera del local.">
                  <Select id="codeTtlSeconds" name="codeTtlSeconds" value={v.codeTtlSeconds} onChange={(e) => set('codeTtlSeconds', Number(e.target.value))} aria-describedby={describedBy('codeTtlSeconds', 'x', err.codeTtlSeconds)}>
                    {ttlOptions.map((s) => <option key={s} value={s}>{ttlLabel(s)}</option>)}
                  </Select>
                </FormField>
                <FormField id="maxSeatsWithoutApproval" label="Cupos máximos sin aprobación" error={err.maxSeatsWithoutApproval}
                  help="Más cupos piden el PIN de un dueño o gerente.">
                  <Select id="maxSeatsWithoutApproval" name="maxSeatsWithoutApproval" value={v.maxSeatsWithoutApproval} onChange={(e) => set('maxSeatsWithoutApproval', Number(e.target.value))} aria-describedby={describedBy('maxSeatsWithoutApproval', 'x', err.maxSeatsWithoutApproval)}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'cupo' : 'cupos'}</option>)}
                  </Select>
                </FormField>
              </div>
              <FormField id="cooldownMinutes" label={`Tiempo mínimo entre sellos del mismo ${vocab.customer}`} error={err.cooldownMinutes} className="max-w-md"
                help={`Evita varios sellos en una sola ${vocab.visit}.`}>
                <Select id="cooldownMinutes" name="cooldownMinutes" value={v.cooldownMinutes} onChange={(e) => set('cooldownMinutes', Number(e.target.value))} aria-describedby={describedBy('cooldownMinutes', 'x', err.cooldownMinutes)}>
                  {cooldownOptions.map((m) => <option key={m} value={m}>{cooldownLabel(m)}</option>)}
                </Select>
              </FormField>
            </Section>
          )}

          {show.terminos && (
            <Section id="sec-terminos" title="Términos y condiciones">
              <FormField id="terms" label="Condiciones del programa" optional error={err.terms} help="Máximo 600 caracteres.">
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
              </div>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
