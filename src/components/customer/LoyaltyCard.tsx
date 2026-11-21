import type { ReactNode } from 'react';
import type { Business, CustomerCard, Program } from '@/lib/contracts';
import { getTemplate } from '@/lib/templates';
import { readableOn } from '@/components/card/contrast';
import { logoInitials, remainingCount, remainingText, visitDate, visitRows } from './card-model';
import { BusinessLogo } from './Shell';
import { StampGrid, StampProgress } from './Stamps';

const HEX = /^#[0-9a-fA-F]{6}$/;
const safe = (c: string | undefined, fallback: string) => (c && HEX.test(c) ? c : fallback);

/** Cabecera con la marca del negocio (va primero): portada, logo, nombre y nombre de la tarjeta. */
export function BusinessHeader({ business, program, children }: { business: Pick<Business, 'name' | 'city'>; program?: Program; children?: ReactNode }) {
  const bg = safe(program?.colors.bg, '#001D3D');
  const ink = safe(program?.colors.ink, '#FFFFFF');
  const accent = safe(program?.colors.accent, '#FFC301');
  const initials = logoInitials(program?.logoText, business.name);
  return (
    <div className="relative overflow-hidden" style={{ background: bg, color: ink }}>
      {program?.coverUrl && (
        <div className="relative h-28 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={program.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 30%, ${bg})` }} />
        </div>
      )}
      <div className={'flex items-center gap-3 px-5 pb-5 ' + (program?.coverUrl ? '-mt-8 relative' : 'pt-5')}>
        <BusinessLogo url={program?.logoUrl} initials={initials} bg={accent} ink={readableOn(accent)} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-tight">{business.name}</h1>
          {program && <p className="mt-0.5 truncate text-sm" style={{ opacity: 0.85 }}>Tarjeta de sellos · {program.name}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export interface LoyaltyCardProps {
  card: CustomerCard;
  frozen?: boolean;
  /** Recién sellado: anima el último sello. */
  pop?: boolean;
  /** Formulario "Escribir código" (solo si la tarjeta está activa y no completa). */
  claimSlot?: ReactNode;
  nowMs?: number;
}

/** La tarjeta del cliente (manual 6.1). */
export function LoyaltyCard({ card, frozen = false, pop = false, claimSlot, nowMs = Date.now() }: LoyaltyCardProps) {
  const { business, program, customer } = card;
  const total = program.stampsRequired;
  const filled = Math.min(customer.stamps, total);
  const complete = remainingCount(filled, total) === 0;
  const vocab = getTemplate(business.type).vocab;
  const rows = visitRows(card.recent, customer.stamps, total).slice(0, 5);
  const tz = business.timezone || 'America/Guayaquil';

  return (
    <div className="space-y-4">
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70" aria-label={`Tarjeta de ${business.name}`}>
        <BusinessHeader business={business} program={program} />
        <div className="space-y-5 px-5 pb-5 pt-5">
          <StampGrid total={total} filled={filled} pop={pop} />
          <StampProgress filled={filled} total={total} />
          {complete ? (
            <div className="rounded-2xl bg-sun px-4 py-3 text-navy">
              <p className="font-display text-lg font-bold leading-snug">{remainingText(filled, total, program.rewardTitle)}</p>
              <p className="mt-1 text-sm font-medium">{frozen ? 'Podrás canjearlo cuando el negocio vuelva a atender.' : `Muéstrale esta pantalla al ${vocab.staffRole}.`}</p>
            </div>
          ) : (
            <p className="font-display text-lg font-semibold leading-snug text-navy">{remainingText(filled, total, program.rewardTitle)}</p>
          )}
          {program.rewardDescription && <p className="-mt-3 text-sm text-muted">{program.rewardDescription}</p>}
          {!frozen && !complete && claimSlot}
        </div>
      </article>

      <section aria-labelledby="visitas" className="rounded-3xl bg-white px-5 py-4 shadow-card ring-1 ring-line/70">
        <h2 id="visitas" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Últimas {vocab.visits}</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aún no tienes sellos. ¡Tu primera {vocab.visit} cuenta!</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-navy">{r.label}</span>
                <span className="tabular-nums text-muted">{visitDate(r.at, nowMs, tz)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {program.birthdayReward && (
        <section className="flex items-start gap-3 rounded-3xl bg-white px-5 py-4 shadow-card ring-1 ring-line/70">
          <span aria-hidden="true" className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC] text-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M8 12V9M12 12V9M16 12V9M8 6v.01M12 6v.01M16 6v.01" /></svg>
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-navy">Regalo de cumpleaños</h2>
            <p className="text-sm text-muted">{program.birthdayReward}{customer.birthday ? ` · el ${customer.birthday.d} de ${MONTH_SHORT[customer.birthday.m]}` : ''}</p>
          </div>
        </section>
      )}

      {program.terms && (
        <details className="rounded-3xl bg-white px-5 py-4 shadow-card ring-1 ring-line/70">
          <summary className="cursor-pointer text-sm font-semibold text-navy">Condiciones de la tarjeta</summary>
          <p className="mt-2 whitespace-pre-line text-sm text-muted">{program.terms}</p>
          {program.rewardExpiresDays ? <p className="mt-2 text-sm text-muted">El premio vence {program.rewardExpiresDays} días después de completar la tarjeta.</p> : null}
        </details>
      )}
    </div>
  );
}

const MONTH_SHORT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
