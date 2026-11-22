import Link from 'next/link';
import type { Business } from '@/lib/contracts';
import { PLAN_LABEL, daysToExpiry } from '@/lib/mvp-rules';
import { stampaWhatsappUrl } from '@/lib/urls';

function shortDate(iso: string, timeZone: string): string {
  try { return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', timeZone }); }
  catch { return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long' }); }
}

/** Plan del negocio en el menú lateral (solo el dueño lo ve). */
export function PlanChip({ business }: { business: Business }) {
  const tz = business.timezone || 'America/Guayaquil';
  const when = business.planExpiresAt
    ? `${business.autoRenew ? 'Se renueva el' : 'Hasta el'} ${shortDate(business.planExpiresAt, tz)}`
    : 'Sin vencimiento';
  return (
    <Link href="/panel/ajustes#plan" className="mb-3 block rounded-xl bg-white/5 px-3.5 py-2.5 hover:bg-white/10">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Tu plan</p>
      <p className="mt-0.5 text-sm font-semibold">{PLAN_LABEL[business.plan]} <span className="font-normal text-white/70">· {when}</span></p>
    </Link>
  );
}

/**
 * Aviso amable cuando el plan está por vencer (7 días o menos) o ya venció. Con renovación automática no hace falta
 * avisar. Va arriba de todas las páginas del panel del dueño.
 */
export function PlanNotice({ business }: { business: Business }) {
  if (business.autoRenew) return null;
  const days = daysToExpiry(business.planExpiresAt);
  if (days === null || days > 7 || !business.planExpiresAt) return null;
  const tz = business.timezone || 'America/Guayaquil';
  const date = shortDate(business.planExpiresAt, tz);
  const plan = PLAN_LABEL[business.plan];
  const expired = days < 0;
  const title = expired ? `Tu plan ${plan} venció el ${date}` : days === 0 ? `Tu plan ${plan} vence hoy` : days === 1 ? `Tu plan ${plan} vence mañana` : `Tu plan ${plan} vence en ${days} días`;
  const text = expired
    ? 'Tus clientes siguen sumando sellos por ahora. Escríbenos y lo renovamos en un momento.'
    : `Vence el ${date}. Renuévalo a tiempo y todo sigue igual para ti y tus clientes.`;
  return (
    <div role="status" className={'mb-6 flex flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ' + (expired ? 'bg-[#FDECEA] text-[#8A1F18]' : 'bg-[#FFF4CC] text-navy')}>
      <div>
        <p className="font-display text-base font-bold">{title}</p>
        <p className="mt-0.5 text-sm">{text}</p>
      </div>
      <a href={stampaWhatsappUrl(`Hola, quiero renovar mi plan ${plan} de Stampa para ${business.name}`)} target="_blank" rel="noopener noreferrer"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-3">
        Renovar por WhatsApp
      </a>
    </div>
  );
}
