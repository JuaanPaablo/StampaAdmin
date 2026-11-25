import type { AdminTask, AdminTaskKind, BusinessHealth, MoneyLine, Severity } from '@/lib/contracts';
import { EC_OFFSET_MINUTES, formatCents } from '@/lib/domain/admin-insights';
import { ownerWhatsappUrl } from '@/lib/urls';
import { num } from '@/lib/format';

/** Reglas puras del Resumen del administrador (sin React ni base de datos). */

/** Hora local de Ecuador (UTC-5 fijo). */
function ecDate(nowMs: number): Date {
  return new Date(nowMs + EC_OFFSET_MINUTES * 60_000);
}

/** "Buenos días" antes de las 12, "Buenas tardes" hasta las 19 y "Buenas noches" después (hora de Ecuador). */
export function ecGreeting(nowMs: number = Date.now()): string {
  const h = ecDate(nowMs).getUTCHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Miércoles 25 de noviembre de 2026" (Ecuador). */
export function ecLongDate(nowMs: number = Date.now()): string {
  const d = ecDate(nowMs);
  const s = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS_FULL[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- Hoy te toca ---------- */

export const SEVERITY_ORDER: Severity[] = ['critical', 'warning', 'info'];
export const SEVERITY_TEXT: Record<Severity, string> = { critical: 'Urgente', warning: 'Pronto', info: 'Cuando puedas' };
export const SEVERITY_TONE: Record<Severity, 'bad' | 'warn' | 'info'> = { critical: 'bad', warning: 'warn', info: 'info' };

/** Agrupa por gravedad respetando el orden que ya trae la lista. Solo devuelve grupos con tareas. */
export function groupTasks(tasks: AdminTask[]): { severity: Severity; tasks: AdminTask[] }[] {
  return SEVERITY_ORDER.map((severity) => ({ severity, tasks: tasks.filter((t) => t.severity === severity) })).filter((g) => g.tasks.length > 0);
}

const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;

const SUMMARY_ORDER: { kinds: AdminTaskKind[]; one: string; many: string }[] = [
  { kinds: ['plan_expired'], one: 'plan vencido', many: 'planes vencidos' },
  { kinds: ['payment_due'], one: 'cobro esta semana', many: 'cobros esta semana' },
  { kinds: ['inactive'], one: 'negocio inactivo', many: 'negocios inactivos' },
  { kinds: ['invite_expired'], one: 'invitación vencida', many: 'invitaciones vencidas' },
  { kinds: ['setup_stuck'], one: 'sin terminar la configuración', many: 'sin terminar la configuración' }
];

/** "2 planes vencidos · 3 cobros esta semana · 1 invitación vencida". Vacío si no hay tareas. */
export function taskSummary(tasks: AdminTask[]): string {
  return SUMMARY_ORDER.map(({ kinds, one, many }) => {
    const n = tasks.filter((t) => kinds.includes(t.kind)).length;
    return n ? plural(n, one, many) : '';
  }).filter(Boolean).join(' · ');
}

const firstName = (name: string) => name.replace(/ · configurando$/, '');

/** Mensaje de WhatsApp o correo, listo para enviar, según el tipo de tarea. */
export function taskMessage(t: Pick<AdminTask, 'kind' | 'businessName' | 'amountCents' | 'days'>): string {
  const biz = firstName(t.businessName);
  const amount = t.amountCents ? ` de ${formatCents(t.amountCents)}` : '';
  switch (t.kind) {
    case 'payment_due': {
      const when = (t.days ?? 0) <= 0 ? 'hoy' : t.days === 1 ? 'mañana' : `en ${t.days} días`;
      return `Hola, te saluda Stampa. El plan de ${biz} vence ${when}. ¿Te ayudo con el pago${amount} para que tus clientes sigan sumando sellos?`;
    }
    case 'plan_expired':
      return `Hola, te saluda Stampa. El plan de ${biz} ya venció. Para seguir usando la tarjeta de sellos, falta el pago${amount}. ¿Te ayudo con eso?`;
    case 'inactive':
      return `Hola, te saluda Stampa. Vimos que ${biz} no registra sellos hace unos días. ¿Todo bien? Si necesitas ayuda con la tarjeta, aquí estoy.`;
    case 'invite_expired':
      return `Hola, te saluda Stampa. Tu enlace para entrar a Stampa venció. Te envío uno nuevo para que crees tu contraseña.`;
    case 'setup_stuck':
      return `Hola, te saluda Stampa. Vimos que aún no terminas de configurar ${biz}. ¿Te ayudo a completarlo? Toma pocos minutos.`;
  }
}

const SUBJECT: Record<AdminTaskKind, string> = {
  payment_due: 'Tu plan de Stampa vence pronto',
  plan_expired: 'Tu plan de Stampa venció',
  inactive: '¿Todo bien con Stampa?',
  invite_expired: 'Tu acceso a Stampa',
  setup_stuck: 'Termina de configurar tu negocio en Stampa'
};

export interface ContactLink { href: string; channel: 'whatsapp' | 'email'; label: string }

/** WhatsApp si hay celular; si no, correo. null si no hay cómo escribirle. */
export function taskContact(t: AdminTask): ContactLink | null {
  const text = taskMessage(t);
  const wa = ownerWhatsappUrl(t.ownerPhone, text);
  if (wa) return { href: wa, channel: 'whatsapp', label: 'WhatsApp' };
  if (t.ownerEmail) {
    return { href: `mailto:${t.ownerEmail}?subject=${encodeURIComponent(SUBJECT[t.kind])}&body=${encodeURIComponent(text)}`, channel: 'email', label: 'Correo' };
  }
  return null;
}

/** Mensaje de cobro para una renovación o un plan vencido. */
export function moneyLineMessage(m: Pick<MoneyLine, 'businessName' | 'amountCents' | 'days'>): string {
  return taskMessage({ kind: m.days < 0 ? 'plan_expired' : 'payment_due', businessName: m.businessName, amountCents: m.amountCents, days: m.days });
}

/* ---------- Fechas relativas ---------- */

/** "Vence hoy", "Mañana", "En 5 días", "Venció hace 3 días". */
export function daysLeftLabel(days: number): string {
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days > 1) return `En ${num(days)} días`;
  if (days === -1) return 'Venció ayer';
  return `Venció hace ${num(-days)} días`;
}

/** "Hoy", "Ayer", "Hace 4 días", "Nunca". */
export function lastStampLabel(days: number | null): string {
  if (days === null) return 'Nunca';
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${num(days)} días`;
}

/* ---------- Semáforo ---------- */

/** Valor del filtro ?salud= en /admin/negocios. */
export const HEALTH_QUERY: Record<Exclude<BusinessHealth, 'none'>, string> = { green: 'verde', yellow: 'amarillo', red: 'rojo' };

/* ---------- Rango de las gráficas ---------- */

export type DaysRange = 30 | 90;
export function parseDaysRange(v: string | string[] | undefined): DaysRange {
  return v === '90' ? 90 : 30;
}

/* ---------- Costo de IA ---------- */

/** Si la IA se come más del 30 % del precio del plan, el negocio deja poco margen: se marca con aviso. */
export const AI_RATIO_WARN = 0.3;
export function aiRatioWarn(ratio: number): boolean {
  return ratio > AI_RATIO_WARN;
}

/** "$0,42" con 2 decimales; montos menores a un centavo como "< $0,01". */
export function formatUsd(v: number): string {
  if (v > 0 && v < 0.005) return '< $0,01';
  return '$' + num(v, 2);
}

/** "12 %" (es-EC, sin decimales; con uno si es menor a 10 %). */
export function formatRatio(r: number): string {
  const p = r * 100;
  return `${num(p, p > 0 && p < 10 ? 1 : 0)} %`;
}
