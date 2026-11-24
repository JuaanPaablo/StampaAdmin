import type { Milestone, Program } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';
import { money, parseMoney } from '@/lib/format';
import { MAX_MILESTONES, validateMilestones } from '@/lib/rewards';

/** Valores editables del formulario (todo texto o número simple) y su traducción a/desde Program. */
export interface FormValues {
  name: string; stampsRequired: number; rewardTitle: string; rewardDescription: string;
  bg: string; accent: string; ink: string; logoText: string;
  birthdayReward: string; rewardExpiresDays: string; terms: string;
  requireAmount: boolean; minSpend: string;
  codeTtlSeconds: number; maxSeatsWithoutApproval: number; cooldownMinutes: number;
  /** Premios intermedios (vacío = solo el premio final). */
  milestones: Milestone[];
}

export const centsToInput = (c: number) => (c / 100).toFixed(2).replace('.', ',');

export function valuesFromProgram(p: Program): FormValues {
  return {
    name: p.name, stampsRequired: p.stampsRequired, rewardTitle: p.rewardTitle, rewardDescription: p.rewardDescription ?? '',
    bg: p.colors.bg, accent: p.colors.accent, ink: p.colors.ink, logoText: p.logoText,
    birthdayReward: p.birthdayReward ?? '', rewardExpiresDays: p.rewardExpiresDays ? String(p.rewardExpiresDays) : '', terms: p.terms ?? '',
    requireAmount: p.requireAmount, minSpend: centsToInput(p.minSpendCentsPerStamp),
    codeTtlSeconds: p.codeTtlSeconds, maxSeatsWithoutApproval: p.maxSeatsWithoutApproval, cooldownMinutes: p.cooldownMinutes,
    milestones: (p.milestones ?? []).map((m) => ({ ...m }))
  };
}

export const ttlLabel = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);
export function cooldownLabel(m: number): string {
  if (m === 0) return 'Sin límite';
  if (m === 60) return '1 hora';
  if (m % 1440 === 0) return m === 1440 ? '24 horas' : `${m / 1440} días`;
  if (m % 60 === 0) return `${m / 60} horas`;
  return `${m} min`;
}

export interface Change { key: string; label: string; from: string; to: string; rule?: boolean; effect?: string }

const short = (s: string) => (s.trim() === '' ? 'vacío' : s.length > 40 ? s.slice(0, 37) + '…' : s);
const stampsFor = (cents: number, spend: number) => (spend > 0 ? Math.floor(cents / spend) : 0);

/** Compara el programa guardado con lo que hay en el formulario y lo explica en lenguaje simple. */
export function describeChanges(base: Program, v: FormValues, vocab: Vocabulary): Change[] {
  const out: Change[] = [];
  const text = (key: string, label: string, a: string, b: string) => {
    if (a.trim() !== b.trim()) out.push({ key, label, from: short(a), to: short(b) });
  };
  text('name', 'Nombre de la tarjeta', base.name, v.name);
  if (base.stampsRequired !== v.stampsRequired) {
    out.push({ key: 'stampsRequired', label: 'Sellos para el premio', from: String(base.stampsRequired), to: String(v.stampsRequired),
      effect: `Las tarjetas en curso se completan con ${v.stampsRequired} sellos.` });
  }
  text('rewardTitle', 'Premio', base.rewardTitle, v.rewardTitle);
  text('rewardDescription', 'Descripción del premio', base.rewardDescription ?? '', v.rewardDescription);
  const ms = (l: Milestone[]) => l.length === 0 ? 'ninguno' : [...l].sort((a, b) => a.at - b.at).map((m) => `sello ${m.at}: ${m.title.trim()}`).join(', ');
  if (ms(base.milestones ?? []) !== ms(v.milestones)) out.push({ key: 'milestones', label: 'Premios en el camino', from: short(ms(base.milestones ?? [])), to: short(ms(v.milestones)) });
  const colorChanged = base.colors.bg.toLowerCase() !== v.bg.toLowerCase() || base.colors.accent.toLowerCase() !== v.accent.toLowerCase() || base.colors.ink.toLowerCase() !== v.ink.toLowerCase();
  if (colorChanged) out.push({ key: 'colors', label: 'Colores de la tarjeta', from: 'anteriores', to: 'nuevos' });
  text('logoText', 'Iniciales del logo', base.logoText, v.logoText);
  text('birthdayReward', 'Regalo de cumpleaños', base.birthdayReward ?? '', v.birthdayReward);
  text('rewardExpiresDays', 'Vigencia del premio (días)', base.rewardExpiresDays ? String(base.rewardExpiresDays) : '', v.rewardExpiresDays);
  text('terms', 'Términos y condiciones', base.terms ?? '', v.terms);

  if (base.requireAmount !== v.requireAmount) {
    out.push({
      key: 'requireAmount', label: 'El sello depende del monto', rule: true,
      from: base.requireAmount ? 'Sí' : 'No', to: v.requireAmount ? 'Sí' : 'No',
      effect: v.requireAmount
        ? `Quien atienda deberá ingresar el monto del ${vocab.ticket.toLowerCase()} y los sellos se calculan con el mínimo por sello.`
        : `Cada ${vocab.visit} da un sello sin importar el monto. El control antifraude se apoya en los cupos y en el tiempo mínimo entre sellos.`
    });
  }
  const spend = parseMoney(v.minSpend);
  if (v.requireAmount && spend > 0 && spend !== base.minSpendCentsPerStamp && base.requireAmount) {
    out.push({
      key: 'minSpend', label: 'Mínimo por sello', rule: true, from: money(base.minSpendCentsPerStamp), to: money(spend),
      effect: `Con un ${vocab.ticket.toLowerCase()} de $10,00 se darán ${stampsFor(1000, spend)} sellos (antes ${stampsFor(1000, base.minSpendCentsPerStamp)}).`
    });
  }
  if (base.codeTtlSeconds !== v.codeTtlSeconds) {
    out.push({ key: 'codeTtlSeconds', label: 'Vigencia del código', rule: true, from: ttlLabel(base.codeTtlSeconds), to: ttlLabel(v.codeTtlSeconds),
      effect: v.codeTtlSeconds < base.codeTtlSeconds ? 'El código vence antes: es más difícil que se comparta fuera del local.' : 'Hay más tiempo para escanear, pero el código queda expuesto más rato.' });
  }
  if (base.maxSeatsWithoutApproval !== v.maxSeatsWithoutApproval) {
    out.push({ key: 'maxSeats', label: 'Cupos sin aprobación', rule: true, from: String(base.maxSeatsWithoutApproval), to: String(v.maxSeatsWithoutApproval),
      effect: v.maxSeatsWithoutApproval < base.maxSeatsWithoutApproval ? 'Más grupos necesitarán el PIN de un dueño o gerente.' : 'Más grupos se atenderán sin PIN de aprobación.' });
  }
  if (base.cooldownMinutes !== v.cooldownMinutes) {
    out.push({ key: 'cooldown', label: 'Tiempo entre sellos de la misma persona', rule: true, from: cooldownLabel(base.cooldownMinutes), to: cooldownLabel(v.cooldownMinutes),
      effect: v.cooldownMinutes === 0 ? 'Una misma persona podrá sumar sellos sin esperar entre uno y otro.' : 'Una persona no podrá sumar otro sello hasta que pase ese tiempo.' });
  }
  return out;
}

/** Partes del formulario que están a la vista (el asistente muestra solo algunas). */
export interface VisibleSections {
  identidad?: boolean; premio?: boolean; premioExtra?: boolean; colores?: boolean; monto?: boolean;
}

/** Orden de los campos en pantalla: sirve para llevar el foco al primer error. */
export const FIELD_ORDER = [
  'name', 'logoText', 'stampsRequired', 'rewardTitle', 'milestones', 'rewardDescription', 'rewardExpiresDays', 'birthdayReward',
  'bg', 'accent', 'ink', 'requireAmount', 'minSpend', 'codeTtlSeconds', 'maxSeatsWithoutApproval', 'cooldownMinutes', 'terms'
] as const;

const HEX6 = /^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{3}$/;

/**
 * Validación en el navegador antes de enviar (mismas reglas que el servidor, que vuelve a validar).
 * Solo revisa las secciones visibles. Devuelve { campo: mensaje }.
 */
export function validateValues(v: FormValues, show: VisibleSections, maxMilestones: number = MAX_MILESTONES): Record<string, string> {
  const e: Record<string, string> = {};
  if (show.identidad) {
    const name = v.name.trim();
    if (name.length < 2) e.name = 'Escribe al menos 2 letras.';
    else if (name.length > 40) e.name = 'Máximo 40 caracteres.';
    if (v.logoText.trim().length < 1) e.logoText = 'Escribe de 1 a 3 letras.';
  }
  if (show.premio) {
    if (v.rewardTitle.trim().length < 2) e.rewardTitle = 'Escribe el premio.';
    if (v.milestones.length) {
      const ms = validateMilestones(v.milestones, v.stampsRequired, maxMilestones);
      if (ms) e.milestones = ms;
    }
  }
  if (show.premioExtra) {
    const d = v.rewardExpiresDays.trim();
    if (d !== '' && !(/^\d+$/.test(d) && Number(d) >= 1 && Number(d) <= 730)) e.rewardExpiresDays = 'Indica de 1 a 730 días o déjalo vacío.';
  }
  if (show.colores) {
    for (const k of ['bg', 'accent', 'ink'] as const) {
      if (!HEX6.test(v[k].trim())) e[k] = 'Usa un color con formato #RRGGBB.';
    }
  }
  if (show.monto && v.requireAmount) {
    const spend = parseMoney(v.minSpend);
    if (!(spend >= 50 && spend <= 50000)) e.minSpend = 'Indica un monto entre $0,50 y $500,00.';
  }
  return e;
}

/** Primer campo con error, en el orden de la pantalla. */
export function firstErrorField(errors: Record<string, string>): string | undefined {
  return FIELD_ORDER.find((k) => errors[k]) ?? Object.keys(errors)[0];
}
