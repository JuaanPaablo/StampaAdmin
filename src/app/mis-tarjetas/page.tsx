import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { readableOn } from '@/components/card/contrast';
import { logoInitials, remainingText } from '@/components/customer/card-model';
import { BusinessLogo, CustomerShell } from '@/components/customer/Shell';
import { SignupFlow } from '@/components/customer/SignupFlow';
import { StampProgress } from '@/components/customer/Stamps';
import { SignOut } from '@/components/customer/views';
import { readCustomerSession, readPendingSignup } from '@/lib/customer-session';
import { businessStatus } from '@/lib/mvp-rules';
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
        <p className="mt-1 text-[15px] text-muted">Todas tus tarjetas de sellos en un solo lugar.</p>
        <div className="mt-5 rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70">
          <SignupFlow allowSignup={false} initialMode="ingreso" resume={resume} />
        </div>
      </CustomerShell>
    );
  }

  const cards = await getRepo().listCustomerCards(session.email);
  return (
    <CustomerShell>
      <div className="mt-2 flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-bold text-navy">Mis tarjetas</h1>
        {cards.length > 0 && <span className="text-sm font-semibold tabular-nums text-muted">{cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}</span>}
      </div>
      {cards.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-white p-5 text-[15px] text-navy shadow-card ring-1 ring-line/70">
          <p className="font-semibold">Aún no tienes tarjetas con este correo.</p>
          <p className="mt-1 text-sm text-muted">Escanea el código QR en tu negocio favorito para crear la primera.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {cards.map(({ business, program, customer }) => {
            const total = program.stampsRequired;
            const filled = Math.min(customer.stamps, total);
            const paused = businessStatus(business) === 'suspended';
            const bg = HEX.test(program.colors.bg) ? program.colors.bg : '#001D3D';
            const ink = HEX.test(program.colors.ink) ? program.colors.ink : '#FFFFFF';
            const accent = HEX.test(program.colors.accent) ? program.colors.accent : '#FFC301';
            return (
              <li key={business.id}>
                <Link href={customerPath(business.slug)} className="block overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70 transition hover:ring-navy/40">
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: bg, color: ink }}>
                    <BusinessLogo url={program.logoUrl} initials={logoInitials(program.logoText, business.name)} bg={accent} ink={readableOn(accent)} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold">{business.name}</p>
                      <p className="truncate text-xs" style={{ opacity: 0.85 }}>Tarjeta de sellos · {program.name}</p>
                    </div>
                    {paused && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-navy">Pausada</span>}
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
