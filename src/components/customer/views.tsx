import Link from 'next/link';
import type { Business, CustomerCard, Program } from '@/lib/contracts';
import { PLACEHOLDER_BUSINESS_NAME } from '@/lib/mvp-rules';
import { Isotipo } from '@/components/shell/logo';
import { rewardPhrase } from './card-model';
import { cleanMilestones, lcfirst, milestoneMap } from '@/lib/rewards';
import { BusinessHeader } from './LoyaltyCard';
import { Notice } from './Shell';
import { StampGrid } from './Stamps';

/** Barra superior: "Mis tarjetas · 1 de 3" cuando el cliente tiene más de una. */
export function CardsTopBar({ index, total }: { index?: number; total: number }) {
  if (total < 2) return null;
  return (
    <div className="mb-3 flex items-center justify-between">
      <Link href="/mis-tarjetas" className="inline-flex min-h-12 items-center gap-1 font-display text-lg font-bold text-navy">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Mis tarjetas
      </Link>
      {index !== undefined && <span className="text-sm font-semibold tabular-nums text-muted">{index + 1} de {total}</span>}
    </div>
  );
}

/** "No soy yo / salir" con confirmación (componente de cliente). */
export { SignOut } from './SignOut';

/** Negocio todavía en configuración. */
export function ComingSoon({ business }: { business: Business }) {
  const named = business.name && business.name !== PLACEHOLDER_BUSINESS_NAME;
  return (
    <div className="mt-10 rounded-3xl bg-navy px-6 py-10 text-center text-white shadow-card">
      <Isotipo size={56} className="mx-auto" />
      <h1 className="mt-5 font-display text-3xl font-bold">Muy pronto</h1>
      <p className="mt-2 text-[15px] text-white/85">
        {named ? `La tarjeta de ${business.name} está casi lista.` : 'Esta tarjeta está casi lista.'} Vuelve en unos días.
      </p>
    </div>
  );
}

/** Negocio pausado y el cliente no tiene tarjeta: aviso, sin registro. */
export function PausedNoCard({ business, program }: { business: Business; program: Program }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70"><BusinessHeader business={business} program={program} /></div>
      <Notice tone="warning" title="Tarjeta en pausa">
        No acepta clientes nuevos ni suma sellos. Si ya tienes tarjeta, ábrela con tu correo.
      </Notice>
    </div>
  );
}

/** Presentación de la tarjeta del negocio para quien aún no tiene sesión. */
export function ProgramIntro({ business, program }: { business: Business; program: Program }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70">
      <BusinessHeader business={business} program={program} />
      <div className="space-y-4 px-5 py-5">
        <p className="font-display text-lg font-semibold leading-snug text-navy">
          Junta {program.stampsRequired} sellos y gana tu {rewardPhrase(program.rewardTitle)}.
        </p>
        {program.rewardDescription && <p className="-mt-2 text-sm text-muted">{program.rewardDescription}</p>}
        <StampGrid total={program.stampsRequired} filled={0} milestones={milestoneMap(program)} />
        {cleanMilestones(program.milestones, program.stampsRequired).length > 0 && (
          <ul className="space-y-1 text-sm text-navy">
            {cleanMilestones(program.milestones, program.stampsRequired).map((m) => (
              <li key={m.at}><strong className="font-semibold">Sello {m.at}:</strong> {m.title}</li>
            ))}
            <li><strong className="font-semibold">Sello {program.stampsRequired}:</strong> {program.rewardTitle}</li>
          </ul>
        )}
        {program.birthdayReward && <p className="text-sm text-muted">Y en tu cumpleaños: {lcfirst(program.birthdayReward)}.</p>}
      </div>
    </div>
  );
}

/** Posición de la tarjeta de este negocio en la lista del cliente. */
export function cardIndex(cards: CustomerCard[], businessId: string): number | undefined {
  const i = cards.findIndex((c) => c.business.id === businessId);
  return i >= 0 ? i : undefined;
}
