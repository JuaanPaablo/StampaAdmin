import Link from 'next/link';
import type { PlatformSummary } from '@/lib/contracts';
import { KpiCard } from '@/components/dashboard';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { SectionHeader, focusRing } from './bits';

const STATUS_LINKS: { key: keyof PlatformSummary['businesses']; label: string; estado: string }[] = [
  { key: 'active', label: 'Activos', estado: 'activos' },
  { key: 'setup', label: 'Configurando', estado: 'configurando' },
  { key: 'suspended', label: 'Suspendidos', estado: 'suspendidos' },
  { key: 'expiringSoon', label: 'Por vencer en 7 días', estado: 'por-vencer' },
  { key: 'expired', label: 'Vencidos', estado: 'vencidos' }
];

/** Uso de la plataforma: negocios por estado, clientes, sellos y canjes. */
export function PlatformSection({ summary }: { summary: PlatformSummary }) {
  const b = summary.businesses;
  return (
    <section aria-labelledby="uso">
      <SectionHeader id="uso" title="Uso de la plataforma" text={`${num(b.total)} ${b.total === 1 ? 'negocio' : 'negocios'} en Stampa.`} />
      <nav aria-label="Negocios por estado" className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 sm:flex-wrap">
          {STATUS_LINKS.map((s) => (
            <li key={s.key}>
              <Link href={`/admin/negocios?estado=${s.estado}`}
                className={cn('inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 text-[13px] font-semibold text-navy ring-1 ring-inset ring-[#C9D6E3] hover:bg-surface', focusRing)}>
                {s.label}
                <span className="font-display tabular-nums">{num(b[s.key])}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="col-span-2 sm:col-span-1"><KpiCard label="Clientes" value={num(summary.customers)} hint="Con tarjeta en algún negocio" /></div>
        <KpiCard label="Sellos" value={num(summary.stamps30d)} hint={`Últimos 30 días · ${num(summary.stampsTotal)} en total`} />
        <KpiCard label="Canjes" value={num(summary.redemptions30d)} hint={`Últimos 30 días · ${num(summary.redemptionsTotal)} en total`} />
      </div>
    </section>
  );
}
