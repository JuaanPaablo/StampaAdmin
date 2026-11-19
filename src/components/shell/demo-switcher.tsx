import type { Business, Staff } from '@/lib/contracts';
import { getTemplate } from '@/lib/templates';
import { roleLabel } from './labels';
import { switchBusinessAction, switchStaffAction } from './actions';

const selectCls = 'h-9 w-full rounded-lg border border-white/20 bg-navy-2 px-2.5 text-[13px] text-white focus:border-sun focus:outline-none focus:ring-2 focus:ring-sun/50';
const btnCls = 'h-9 shrink-0 rounded-lg bg-white/10 px-3 text-[13px] font-semibold text-white hover:bg-white/20';

/** Conmutador de demostración (servidor). Escribe las cookies stampa_biz y stampa_staff mediante server actions. */
export function DemoSwitcher({ businesses, staff, businessId, staffId }: { businesses: Business[]; staff: Staff[]; businessId: string; staffId: string }) {
  const template = getTemplate(businesses.find((b) => b.id === businessId)?.type ?? 'otro');
  return (
    <details className="group rounded-xl border border-dashed border-sun/50 bg-white/5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full bg-sun px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wider text-navy">Modo demo</span>
          <span className="text-white/80">Cambiar negocio</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-open:rotate-180" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        <p className="text-xs leading-relaxed text-white/60">Solo para ver el mismo panel en distintos tipos de negocio y con distintos roles.</p>
        <form action={switchBusinessAction} className="flex flex-col gap-1.5">
          <label htmlFor="demo-negocio" className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Negocio</label>
          <div className="flex gap-2">
            <select id="demo-negocio" name="businessId" defaultValue={businessId} className={selectCls}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name} ({getTemplate(b.type).label})</option>)}
            </select>
            <button type="submit" className={btnCls}>Ir</button>
          </div>
        </form>
        <form action={switchStaffAction} className="flex flex-col gap-1.5">
          <label htmlFor="demo-persona" className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Persona que opera</label>
          <div className="flex gap-2">
            <select id="demo-persona" name="staffId" defaultValue={staffId} className={selectCls}>
              {staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({roleLabel(s.role, template.vocab)})</option>)}
            </select>
            <button type="submit" className={btnCls}>Ir</button>
          </div>
        </form>
      </div>
    </details>
  );
}
