import type { NewOfferInput, Offer } from '@/lib/contracts';
import { ecDayKey, isDayKey } from '@/lib/domain/admin-insights';
import { cleanOfferInput, OFFER_MAX_DAYS, offerWindowFromDays, validateOffer, type OfferField } from '@/lib/domain/wallet-cards';

/**
 * Lectura del formulario de cupones del panel (pura, segura para el navegador y probada en offer-form.test.ts).
 * La vigencia se elige como "día de inicio + cuántos días dura" o "día de inicio + día final" (calendario de Ecuador).
 */

export type ValidityMode = 'days' | 'end';

export interface OfferFormValues {
  title: string;
  description: string;
  terms: string;
  imageUrl: string;
  /** 'YYYY-MM-DD' */
  startDay: string;
  mode: ValidityMode;
  /** Días que dura (texto del campo). */
  days: string;
  /** 'YYYY-MM-DD' */
  endDay: string;
}

/** Nombres de los campos del formulario (también son las claves de fieldErrors). */
export type OfferFormField = 'title' | 'description' | 'terms' | 'imageUrl' | 'startDay' | 'days' | 'endDay';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Lee los valores de un FormData o de un objeto plano. */
export function readOfferForm(src: FormData | Record<string, unknown>): OfferFormValues {
  const get = (k: string) => (typeof FormData !== 'undefined' && src instanceof FormData ? str(src.get(k)) : str((src as Record<string, unknown>)[k]));
  return {
    title: get('title'),
    description: get('description'),
    terms: get('terms'),
    imageUrl: get('imageUrl'),
    startDay: get('startDay').trim(),
    mode: get('mode') === 'end' ? 'end' : 'days',
    days: get('days').trim(),
    endDay: get('endDay').trim()
  };
}

/** Hoy en Ecuador, 'YYYY-MM-DD'. */
export const todayEc = (nowMs: number = Date.now()): string => ecDayKey(nowMs);

/** Suma días a 'YYYY-MM-DD' (puede ser negativo). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Días entre dos fechas, contando ambas ('2026-12-01' a '2026-12-07' = 7). */
export function daysInclusive(startDay: string, endDay: string): number {
  const [y1, m1, d1] = startDay.split('-').map(Number);
  const [y2, m2, d2] = endDay.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) + 1;
}

/** Lee "cuántos días dura": entero de 1 a OFFER_MAX_DAYS, o null. */
export function parseDuration(days: string): number | null {
  if (!/^\d{1,3}$/.test(days.trim())) return null;
  const n = Number(days);
  return n >= 1 && n <= OFFER_MAX_DAYS ? n : null;
}

/** Último día de vigencia según el modo elegido (null si falta o no es válido). */
export function resolveEndDay(v: Pick<OfferFormValues, 'startDay' | 'mode' | 'days' | 'endDay'>): string | null {
  if (!isDayKey(v.startDay)) return null;
  if (v.mode === 'end') return isDayKey(v.endDay) ? v.endDay : null;
  const n = parseDuration(v.days);
  return n ? addDays(v.startDay, n - 1) : null;
}

export type OfferFormResult = { ok: true; input: NewOfferInput } | { ok: false; fieldErrors: Partial<Record<OfferFormField, string>> };

/** Convierte el formulario en NewOfferInput validado con las reglas comunes (validateOffer). */
export function offerInputFromForm(v: OfferFormValues, nowMs: number = Date.now()): OfferFormResult {
  if (!isDayKey(v.startDay)) return { ok: false, fieldErrors: { startDay: 'Elige desde qué día vale el cupón.' } };
  const endField: OfferFormField = v.mode === 'end' ? 'endDay' : 'days';
  const endDay = resolveEndDay(v);
  if (!endDay) {
    return { ok: false, fieldErrors: { [endField]: v.mode === 'end' ? 'Elige hasta qué día vale el cupón.' : `Escribe cuántos días dura (de 1 a ${OFFER_MAX_DAYS}).` } };
  }
  if (endDay < v.startDay) return { ok: false, fieldErrors: { endDay: 'El día final debe ser igual o posterior al inicial.' } };
  const win = offerWindowFromDays(v.startDay, endDay)!;
  const input = cleanOfferInput({ title: v.title, description: v.description, terms: v.terms, imageUrl: v.imageUrl, ...win });
  const err = validateOffer(input, nowMs);
  if (err) {
    const map: Record<OfferField, OfferFormField> = { title: 'title', description: 'description', terms: 'terms', imageUrl: 'imageUrl', startsAt: 'startDay', endsAt: endField };
    return { ok: false, fieldErrors: { [map[err.field]]: err.error } };
  }
  return { ok: true, input };
}

/** Valores iniciales del formulario: vacío (nuevo, empieza hoy y dura 7 días) o los de un borrador. */
export function offerFormDefaults(offer?: Pick<Offer, 'title' | 'description' | 'terms' | 'imageUrl' | 'startsAt' | 'endsAt'>, nowMs: number = Date.now()): OfferFormValues {
  if (!offer) {
    const startDay = todayEc(nowMs);
    return { title: '', description: '', terms: '', imageUrl: '', startDay, mode: 'days', days: '7', endDay: addDays(startDay, 6) };
  }
  const startDay = ecDayKey(offer.startsAt);
  const endDay = ecDayKey(offer.endsAt);
  return {
    title: offer.title, description: offer.description, terms: offer.terms ?? '', imageUrl: offer.imageUrl ?? '',
    startDay, mode: 'end', days: String(Math.max(1, daysInclusive(startDay, endDay))), endDay
  };
}

/* ===================================== Textos ===================================== */

const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "5 de diciembre" (o "5 de diciembre de 2027" si no es el año de `nowMs`), para 'YYYY-MM-DD'. */
export function dayLabel(day: string, nowMs: number = Date.now()): string {
  if (!isDayKey(day)) return '';
  const [y, m, d] = day.split('-').map(Number);
  const sameYear = todayEc(nowMs).slice(0, 4) === String(y);
  return `${d} de ${MONTHS_LONG[m - 1]}${sameYear ? '' : ` de ${y}`}`;
}

/** "Válido del 1 al 7 de diciembre", "Válido solo el 5 de diciembre", "Válido del 28 de noviembre al 3 de diciembre". */
export function validityLabel(startDay: string, endDay: string | null, nowMs: number = Date.now()): string {
  if (!isDayKey(startDay) || !endDay || !isDayKey(endDay)) return 'Elige las fechas';
  if (startDay === endDay) return `Válido solo el ${dayLabel(startDay, nowMs)}`;
  const a = dayLabel(startDay, nowMs);
  const b = dayLabel(endDay, nowMs);
  const sameMonth = startDay.slice(0, 7) === endDay.slice(0, 7);
  return sameMonth ? `Válido del ${Number(startDay.slice(8))} al ${b}` : `Válido del ${a} al ${b}`;
}

/** Igual que validityLabel pero desde una oferta guardada (fechas ISO). */
export const offerValidityLabel = (o: Pick<Offer, 'startsAt' | 'endsAt'>, nowMs: number = Date.now()): string =>
  validityLabel(ecDayKey(o.startsAt), ecDayKey(o.endsAt), nowMs);

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Campañas restantes del mes en palabras. */
export function campaignsLeftText(remaining: number, limit: number): string {
  if (limit <= 0) return 'Tu plan no incluye envíos de cupones.';
  if (remaining <= 0) return `Ya enviaste los ${plural(limit, 'cupón', 'cupones')} de este mes. El próximo mes puedes enviar de nuevo.`;
  return `Te ${remaining === 1 ? 'queda' : 'quedan'} ${plural(remaining, 'envío', 'envíos')} este mes (de ${limit}).`;
}

/**
 * Resultado de enviar un cupón, en palabras simples. `customers` es la palabra del negocio en plural ("clientes").
 * notified = a quienes les llegó el aviso al celular; skipped = el resto (lo ven igual en su tarjeta).
 */
export function sendResultMessage(r: { total: number; notified: number; skipped: number }, words: { customer: string; customers: string } = { customer: 'cliente', customers: 'clientes' }): string {
  if (r.total === 0) return `Cupón enviado. Todavía no tienes ${words.customers} registrados, así que nadie lo recibió.`;
  const sent = `Cupón enviado a ${plural(r.total, words.customer, words.customers)}.`;
  if (r.skipped === 0) return `${sent} A ${r.total === 1 ? 'esa persona le' : 'todos les'} llegó un aviso al celular.`;
  const why = 'no tienen la tarjeta guardada en su celular o ya recibieron el máximo de avisos de hoy (3 al día)';
  if (r.notified === 0) return `${sent} Lo verán al abrir su tarjeta. Esta vez no enviamos avisos al celular: ${r.total === 1 ? 'no tiene la tarjeta guardada en su celular o ya recibió el máximo de avisos de hoy (3 al día)' : why}.`;
  return `${sent} A ${plural(r.notified, 'persona', 'personas')} le${r.notified === 1 ? '' : 's'} llegó un aviso al celular. ${r.skipped === 1 ? 'La otra lo verá' : `Las otras ${r.skipped} lo verán`} al abrir su tarjeta: ${r.skipped === 1 ? 'no tiene la tarjeta guardada en su celular o ya recibió el máximo de avisos de hoy (3 al día)' : why}.`;
}

/* ===================================== Errores ===================================== */

const TECHNICAL = /\b(the|of|is|not|for|violates|null|row|rows|column|relation|function|duplicate|syntax|failed|fetch|timeout|constraint|permission|JWT|PGRST|ECONN\w*|undefined)\b/i;

/**
 * Mensaje para mostrar a partir de un error del repo: los errores de reglas vienen en español y se muestran tal cual;
 * los técnicos (base de datos, red) se cambian por `fallback`.
 */
export function friendlyError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const m = e.message.trim();
  if (!m || m.length > 220 || TECHNICAL.test(m)) return fallback;
  return m;
}

/** Lee el resultado del envío que viaja en la URL ('enviado=10.4' → total 10, avisados 4). null si no es válido. */
export function parseSentQuery(v: string | undefined): { total: number; notified: number; skipped: number } | null {
  const m = /^(\d{1,7})\.(\d{1,7})$/.exec(v ?? '');
  if (!m) return null;
  const total = Number(m[1]);
  const notified = Number(m[2]);
  if (notified > total) return null;
  return { total, notified, skipped: total - notified };
}
