import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/admin/AuthShell';
import { InvalidLinkBody } from '@/components/admin/InvalidLink';
import { SetPasswordForm } from '@/components/admin/SetPasswordForm';
import { PLACEHOLDER_BUSINESS_NAME } from '@/lib/mvp-rules';
import { getRepo } from '@/lib/repo';
import { isTokenShape } from '@/lib/tokens';
import { resetPath } from '@/lib/urls';

export const dynamic = 'force-dynamic';
// El token va en la ruta: que no salga en el Referer ni se indexe.
export const metadata: Metadata = { title: 'Tu acceso · Stampa', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default async function InvitationPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const info = isTokenShape(token) ? await getRepo().peekAccessToken(token) : null;
  if (info?.kind === 'reset') redirect(resetPath(token));

  if (!info) {
    return (
      <AuthShell title="Este enlace ya no sirve">
        <InvalidLinkBody mode="invite" />
      </AuthShell>
    );
  }

  const isNewBusiness = info.businessStatus === 'setup' || info.businessName === PLACEHOLDER_BUSINESS_NAME;
  return (
    <AuthShell
      title="Hola, crea tu contraseña"
      subtitle={
        <>
          {!isNewBusiness && <><strong className="font-semibold text-navy">{info.businessName}</strong> · </>}
          <span className="break-all">{info.email}</span>
        </>
      }
    >
      <SetPasswordForm token={token} mode="invite" email={info.email} defaultName={info.staffName} />
    </AuthShell>
  );
}
