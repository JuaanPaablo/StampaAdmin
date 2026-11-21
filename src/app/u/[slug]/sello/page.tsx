import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoClaim } from '@/components/customer/ClaimForm';
import { JoinForm } from '@/components/customer/JoinForm';
import { BusinessHeader } from '@/components/customer/LoyaltyCard';
import { CustomerShell, Notice, secondaryBtn } from '@/components/customer/Shell';
import { SignupFlow } from '@/components/customer/SignupFlow';
import { cleanCode } from '@/components/customer/card-model';
import { CardsTopBar, ComingSoon, PausedNoCard, ProgramIntro, SignOut } from '@/components/customer/views';
import { customerPath } from '@/lib/urls';
import { customerMetadata, loadCustomerPage } from '../data';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> };

export async function generateMetadata({ params }: Props) {
  return customerMetadata(params.slug);
}

/** Lo que abre el QR de la pantalla de caja: /u/<slug>/sello?c=123456. */
export default async function StampPage({ params, searchParams }: Props) {
  const data = await loadCustomerPage(params.slug);
  if (!data) notFound();
  const { business, status, program, session, cards, mine, pending } = data;
  const code = cleanCode(typeof searchParams.c === 'string' ? searchParams.c : '');
  const cardLink = <Link href={customerPath(business.slug)} className={secondaryBtn}>Ver mi tarjeta</Link>;

  if (status === 'setup') return <CustomerShell><ComingSoon business={business} /></CustomerShell>;
  if (status === 'suspended') {
    return (
      <CustomerShell>
        <PausedNoCard business={business} program={program} />
        <div className="mt-4">{cardLink}</div>
      </CustomerShell>
    );
  }
  if (!code) {
    return (
      <CustomerShell>
        <Notice tone="error" title="Este enlace no trae un código válido">Pide en caja que te muestren el código otra vez o escríbelo a mano en tu tarjeta.</Notice>
        <div className="mt-4">{cardLink}</div>
      </CustomerShell>
    );
  }

  if (session && mine) {
    return (
      <CustomerShell top={<CardsTopBar total={cards.length} />}>
        <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line/70">
          <BusinessHeader business={business} program={program} />
          <div className="space-y-4 px-5 py-5">
            <h2 className="font-display text-xl font-bold text-navy">Tu sello</h2>
            <AutoClaim slug={business.slug} code={code} />
            {cardLink}
          </div>
        </div>
        <SignOut slug={business.slug} email={session.email} />
      </CustomerShell>
    );
  }

  if (session) {
    const other = cards[0]?.customer;
    return (
      <CustomerShell top={<CardsTopBar total={cards.length} />}>
        <ProgramIntro business={business} program={program} />
        <div className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70">
          <JoinForm slug={business.slug} businessName={business.name} email={session.email} stampCode={code}
            prefill={other ? { name: other.name, day: other.birthday?.d, month: other.birthday?.m, year: other.birthdayYear } : undefined} />
          <p className="mt-3 text-center text-sm text-muted">Al unirte sumamos tu sello del código {code}.</p>
        </div>
        <SignOut slug={business.slug} email={session.email} />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <Notice tone="info" title="Estás a un paso de tu sello">Crea tu tarjeta o ábrela con tu correo. Al terminar sumamos el sello del código {code}.</Notice>
      <div className="mt-4"><ProgramIntro business={business} program={program} /></div>
      <div className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70">
        <SignupFlow slug={business.slug} businessName={business.name} allowSignup stampCode={code}
          resume={pending && pending.stampCode === code ? { mode: pending.mode, email: pending.email } : undefined} />
      </div>
    </CustomerShell>
  );
}
