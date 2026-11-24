import type { ReactNode } from 'react';
import type { Business, CustomerCard, Program } from '@/lib/contracts';
import { getTemplate } from '@/lib/templates';
import { contrastRatio, readableOn } from '@/components/card/contrast';
import { logoInitials, remainingText, visitDate, visitRows } from './card-model';
import { framingStyle, milestoneMap, nextReward, pendingRewards } from '@/lib/rewards';
import { BusinessLogo } from './Shell';
import { StampGrid, StampProgress } from './Stamps';

const HEX = /^#[0-9a-fA-F]{6}$/;
const safe = (c: string | undefined, fallback: string) => (c && HEX.test(c) ? c : fallback);

/** Texto del negocio sobre su fondo: si el par elegido no llega a AA (4,5:1), usa blanco o Azul Noche. */
export function headerInk(bg: string, ink: string): string {
  return contrastRatio(ink, bg) >= 4.5 ? ink : readableOn(bg);
}

/** Cabecera con la marca del negocio (va primero): portada, logo, nombre y nombre de la tarjeta. */
export function BusinessHeader({ business, program, children }: { business: Pick<Business, 'name' | 'city'>; program?: Program; children?: ReactNode }) {
  const bg = safe(program?.colors.bg, '#001D3D');
  const ink = headerInk(bg, safe(program?.colors.ink, '#FFFFFF'));
  const accent = safe(program?.colors.accent, '#FFC301');
  const initials = logoInitials(program?.logoText, business.name);
  return (
    <div className="relative overflow-hidden" style={{ background: bg, color: ink }}>
      {program?.coverUrl && (
        <div className="relative h-28 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={program.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={framingStyle(program.imageFraming?.cover)} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 30%, ${bg})` }} />
        </div>
      )}
      <div className={'flex items-center gap-3 px-5 pb-5 ' + (program?.coverUrl ? '-mt-8 relative' : 'pt-5')}>
        <BusinessLogo url={program?.logoUrl} initials={initials} bg={accent} ink={readableOn(accent)} framing={program?.imageFraming?.logo} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-tight">{business.name}</h1>
          {program && <p className="mt-0.5 truncate text-sm" style={{ opacity: 0.85 }}>{program.name.trim() || 'Tarjeta de sellos'}</p>}
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
  const complete = filled >= total;
  const ready = pendingRewards(customer, program).filter((r) => r.milestone !== undefined);
  const next = nextReward(filled, program);
  const gifts = milestoneMap(program);
  const vocab = getTemplate(business.type).vocab;
  const rows = visitRows(card.recent, customer.stamps, total).slice(0, 5);
  const tz = business.timezone || 'America/Guayaquil';

  return (
    <div className="space-y-4">
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70" aria-label={`Tarjeta de ${business.name}`}>
        <BusinessHeader business={business} program={program} />
        <div className="space-y-4 px-5 pb-5 pt-5">
          {/* Lo principal primero: premio listo, cuántos sellos llevas y cuánto falta. */}
          {complete ? (
            <RewardReady title={remainingText(filled, total, program.rewardTitle)} frozen={frozen} staff={vocab.staffRole} />
          ) : ready.map((r) => (
            <RewardReady key={r.milestone} title={`¡Ganaste: ${r.title}!`} frozen={frozen} staff={vocab.staffRole} />
          ))}
          <div>
            <StampProgress filled={filled} total={total} />
            {!complete && <p className="mt-2 font-display text-lg font-semibold leading-snug text-navy">{remainingText(filled, next.at, next.title)}</p>}
            {program.rewardDescription && <p className="mt-0.5 text-sm text-muted">{program.rewardDescription}</p>}
          </div>
          <StampGrid total={total} filled={filled} pop={pop} milestones={gifts} />
          {!frozen && !complete && claimSlot}
        </div>
      </article>

      {/* Sin sellos todavía no hay nada que listar: la sección aparece con la primera visita. */}
      {rows.length > 0 && (
        <section aria-labelledby="visitas" className="rounded-3xl bg-white px-5 py-4 shadow-card ring-1 ring-line/70">
          <h2 id="visitas" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Últimas {vocab.visits}</h2>
          <ul className="mt-1 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-navy">{r.label}</span>
                <span className="tabular-nums text-muted">{visitDate(r.at, nowMs, tz)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

/** Premio listo para canjear: lo más visible de la tarjeta, con la instrucción de qué hacer. */
function RewardReady({ title, frozen, staff }: { title: string; frozen: boolean; staff: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-sun px-4 py-3 text-navy">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-1 h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v9H5v-9" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </svg>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em]">Premio listo</p>
        <p className="font-display text-xl font-bold leading-snug">{title}</p>
        <p className="mt-0.5 text-sm font-semibold">{frozen ? 'Canjéalo cuando el negocio vuelva a atender.' : `Para canjearlo, muéstrale esta pantalla al ${staff}.`}</p>
      </div>
    </div>
  );
}

const MONTH_SHORT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
