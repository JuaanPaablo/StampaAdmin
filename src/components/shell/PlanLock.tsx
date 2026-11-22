import type { Plan } from '@/lib/contracts';
import { PLAN_LABEL, planPrice } from '@/lib/plans';
import { stampaWhatsappUrl } from '@/lib/urls';

/** Aviso compacto para funciones de un plan superior: título, una línea de beneficio y botón a WhatsApp. */
export function PlanLock({ title, text, plan, businessName, compact }: {
  title: string; text: string; plan: Plan; businessName: string; compact?: boolean;
}) {
  const label = PLAN_LABEL[plan];
  return (
    <div className={'flex flex-col gap-3 rounded-2xl border border-dashed border-[#C9D6E3] bg-white sm:flex-row sm:items-center sm:justify-between ' + (compact ? 'px-4 py-3' : 'px-4 py-4 sm:px-5')}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#FFF3CC] text-sm">🔒</span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[15px] font-semibold text-navy">
            {title}
            <span className="rounded-full bg-[#FFF3CC] px-2 py-0.5 text-[11px] font-semibold text-[#7A5A00]">{label}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted">{text}</p>
        </div>
      </div>
      <a href={stampaWhatsappUrl(`Hola, quiero pasar ${businessName} al plan ${label} de Stampa (${planPrice(plan)} al mes).`)}
        target="_blank" rel="noopener noreferrer"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-3 sm:h-10">
        Pasar a {label}
      </a>
    </div>
  );
}
