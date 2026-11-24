import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { readableOn } from '@/components/card/contrast';
import { logoInitials, remainingText } from '@/components/customer/card-model';
import { BusinessLogo, CustomerShell } from '@/components/customer/Shell';
import { SignupFlow } from '@/components/customer/SignupFlow';
import { headerInk } from '@/components/customer/LoyaltyCard';
import { StampProgress } from '@/components/customer/Stamps';
import { SignOut } from '@/components/customer/views';
import { readCustomerSession, readPendingSignup } from '@/lib/customer-session';
import { businessStatus } from '@/lib/mvp-rules';
import { pendingRewards } from '@/lib/rewards';
import { getRepo } from '@/lib/repo';
import { customerPath } from '@/lib/urls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mis tarjetas · Stampa', robots: { index: false, follow: false, nocache: true } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#001D3D' };

const HEX = /^#[0-9a-fA-F]{6}$/;

export default async function MyCardsPage() {
  const session = await readCustomerSession();
  if (!session) {
    const pending = await readPendingSignup();
    const resume = pending && !pending.slug ? { mode: pending.mode, email: pending.email } : undefined;
    return (
      <CustomerShell>
        <h1 className="mt-2 font-display text-3xl font-bold text-navy">Mis tarjetas</h1>
        <div className="mt-5 rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70">
          <SignupFlow allowSignup={false} initialMode="ingreso" resume={resume} />
        </div>
      </CustomerShell>
    );
  }

  const cards = await getRepo().listCustomerCards(session.email);
  return (
    <CustomerShell wide={cards.length > 1}>
      <div className="mt-2 flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-bold text-navy">Mis tarjetas</h1>
        {cards.length > 0 && <span className="text-sm font-semibold tabular-nums text-muted">{cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}</span>}
      </div>
      {cards.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-white p-5 text-[15px] text-navy shadow-card ring-1 ring-line/70">
          <p className="font-semibold">Aún no tienes tarjetas con este correo.</p>
          <p className="mt-1 text-sm text-muted">Escanea el QR del negocio para crear la primera. Si usaste otro correo, sal y entra con ese.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {cards.map(({ business, program, customer }) => {
            const total = program.stampsRequired;
            const filled = Math.min(customer.stamps, total);
            const paused = businessStatus(business) === 'suspended';
            // Premio por canjear (tarjeta completa o premio intermedio): se destaca para que no se olvide.
            const prize = filled >= total || pendingRewards(customer, program).some((r) => r.milestone !== undefined);
            const bg = HEX.test(program.colors.bg) ? program.colors.bg : '#001D3D';
            const ink = headerInk(bg, HEX.test(program.colors.ink) ? program.colors.ink : '#FFFFFF');
            const accent = HEX.test(program.colors.accent) ? program.colors.accent : '#FFC301';
            return (
              <li key={business.id}>
                <Link href={customerPath(business.slug)} className="block h-full overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70 transition hover:ring-navy/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/40">
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: bg, color: ink }}>
                    <BusinessLogo url={program.logoUrl} initials={logoInitials(program.logoText, business.name)} bg={accent} ink={readableOn(accent)} size={44} framing={program.imageFraming?.logo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold">{business.name}</p>
                      <p className="truncate text-xs" style={{ opacity: 0.85 }}>{/^tarjeta de sellos$/i.test(program.name.trim()) ? 'Tarjeta de sellos' : `Tarjeta de sellos · ${program.name}`}</p>
                    </div>
                    {paused && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-navy">Pausada</span>}
                    {!paused && prize && <span className="shrink-0 rounded-full bg-sun px-2.5 py-1 text-xs font-bold text-navy ring-1 ring-white/70">¡Premio listo!</span>}
                  </div>
                  <div className="space-y-2 px-4 py-3">
                    <StampProgress filled={filled} total={total} />
                    <p className="text-sm font-semibold text-navy">{remainingText(filled, total, program.rewardTitle)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <SignOut email={session.email} />
    </CustomerShell>
  );
}
