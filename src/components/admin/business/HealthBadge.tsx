import type { BusinessHealth } from '@/lib/contracts';
import { HEALTH_LABEL } from '@/lib/domain/admin-insights';
import { cn } from '@/lib/cn';

/** Colores del semáforo. El texto siempre acompaña al color (nunca solo el punto). Contraste AA sobre su fondo. */
const TONE: Record<BusinessHealth, { box: string; dot: string }> = {
  green: { box: 'bg-[#DDF3E8] text-[#12683F]', dot: 'bg-[#1E9E64]' },
  yellow: { box: 'bg-[#FFF3CC] text-[#7A5A00]', dot: 'bg-[#B98900]' },
  red: { box: 'bg-[#FBE0DE] text-[#9B2A22]', dot: 'bg-bad' },
  none: { box: 'bg-surface text-muted', dot: 'bg-[#9FB1C5]' }
};

/** Semáforo de actividad: punto + texto ("Activo", "Bajando", "Sin uso", "No aplica") y, si se pasa, el detalle. */
export function HealthBadge({ health, detail, className, prefix }: { health: BusinessHealth; detail?: string; className?: string; prefix?: string }) {
  const t = TONE[health];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none whitespace-nowrap', t.box, className)}>
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', t.dot)} />
      <span>
        {prefix && <span className="font-normal">{prefix} </span>}{HEALTH_LABEL[health]}
        {detail && <span className="font-normal"> · {detail}</span>}
      </span>
    </span>
  );
}
