import type { Plan } from '@/lib/contracts';
import { PLAN_LABEL, planPrice } from '@/lib/plans';
import { stampaWhatsappUrl } from '@/lib/urls';

/** Aviso amable para funciones de un plan superior. Lleva a WhatsApp para cambiar de plan. */
export function PlanLock({ title, text, plan, businessName, compact }: {
  title: string; text: string; plan: Plan; businessName: string; compact?: boolean;
}) {
  const label = PLAN_LABEL[plan];
  return (
    <div className={'flex flex-col gap-3 rounded-2xl border border-dashed border-[#C9D6E3] bg-white sm:flex-row sm:items-center sm:justify-between ' + (compact ? 'px-4 py-3' : 'px-5 py-5')}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-display text-base font-semibold text-navy">
          {title}
          <span className="rounded-full bg-[#FFF3CC] px-2.5 py-0.5 text-[11px] font-semibold text-[#7A5A00]">Desde {label}</span>
        </p>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
      <a href={stampaWhatsappUrl(`Hola, quiero pasar ${businessName} al plan ${label} de Stampa (${planPrice(plan)} al mes).`)}
        target="_blank" rel="noopener noreferrer"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-3">
        Cambiar a {label}
      </a>
    </div>
  );
}
