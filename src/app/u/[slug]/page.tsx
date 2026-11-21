import { notFound } from 'next/navigation';
import { ClaimForm } from '@/components/customer/ClaimForm';
import { JoinForm } from '@/components/customer/JoinForm';
import { LoyaltyCard } from '@/components/customer/LoyaltyCard';
import { CustomerShell, Notice, Split } from '@/components/customer/Shell';
import { SignupFlow } from '@/components/customer/SignupFlow';
import { cardIndex, CardsTopBar, ComingSoon, PausedNoCard, ProgramIntro, SignOut } from '@/components/customer/views';
import { stampedText } from '@/components/customer/card-model';
import { customerMetadata, loadCustomerPage } from './data';

export const dynamic = 'force-dynamic';

type Props = { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> };

export async function generateMetadata({ params }: Props) {
  return customerMetadata(params.slug);
}

export default async function CustomerPage({ params, searchParams }: Props) {
  const data = await loadCustomerPage(params.slug);
  if (!data) notFound();
  const { business, status, program, session, cards, mine, pending } = data;

  if (status === 'setup') return <CustomerShell><ComingSoon business={business} /></CustomerShell>;

  if (session && mine) {
    const frozen = status === 'suspended';
    const total = program.stampsRequired;
    const sealed = searchParams.sellado === '1' && !frozen;
    return (
      <CustomerShell top={<CardsTopBar index={cardIndex(cards, business.id)} total={cards.length} />}>
        <div className="space-y-4">
          {frozen && (
            <Notice tone="warning" title="Este negocio pausó su tarjeta por ahora">
              Tus sellos están guardados. Por ahora no se pueden sumar sellos ni canjear premios.
            </Notice>
          )}
          {sealed && <Notice tone="success" title={stampedText(mine.customer.stamps, total, program.rewardTitle)} />}
          {!sealed && searchParams.nueva === '1' && <Notice tone="success" title="¡Tu tarjeta ya está lista!">Muestra tu código en caja en cada visita y suma sellos.</Notice>}
          {!sealed && searchParams.hola === '1' && <Notice tone="info" title={`¡Qué bueno verte, ${mine.customer.name.split(' ')[0]}!`} />}
          <LoyaltyCard card={mine} frozen={frozen} pop={sealed} claimSlot={<ClaimForm slug={business.slug} />} />
        </div>
        <SignOut slug={business.slug} email={session.email} />
      </CustomerShell>
    );
  }

  if (status === 'suspended') {
    return (
      <CustomerShell top={<CardsTopBar total={cards.length} />} wide={!session}>
        {session ? (
          <>
            <PausedNoCard business={business} program={program} />
            <SignOut slug={business.slug} email={session.email} />
          </>
        ) : (
          <Split aside={<PausedNoCard business={business} program={program} />}>
            <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70 lg:p-7">
              <SignupFlow slug={business.slug} businessName={business.name} allowSignup={false}
                resume={pending ? { mode: pending.mode, email: pending.email } : undefined} />
            </div>
          </Split>
        )}
      </CustomerShell>
    );
  }

  if (session) {
    const other = cards[0]?.customer;
    return (
      <CustomerShell top={<CardsTopBar total={cards.length} />} wide>
        <Split aside={<ProgramIntro business={business} program={program} />}>
          <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70 lg:p-7">
            <JoinForm slug={business.slug} businessName={business.name} email={session.email}
              prefill={other ? { name: other.name, day: other.birthday?.d, month: other.birthday?.m, year: other.birthdayYear } : undefined} />
          </div>
          <SignOut slug={business.slug} email={session.email} />
        </Split>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell wide>
      <Split aside={<ProgramIntro business={business} program={program} />}>
        <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line/70 lg:p-7">
          <SignupFlow slug={business.slug} businessName={business.name} allowSignup
            initialMode={searchParams.ingreso === '1' ? 'ingreso' : 'alta'}
            resume={pending ? { mode: pending.mode, email: pending.email } : undefined} />
        </div>
      </Split>
    </CustomerShell>
  );
}
