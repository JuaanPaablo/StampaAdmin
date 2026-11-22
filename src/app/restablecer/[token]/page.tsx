import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/admin/AuthShell';
import { InvalidLinkBody } from '@/components/admin/InvalidLink';
import { SetPasswordForm } from '@/components/admin/SetPasswordForm';
import { getRepo } from '@/lib/repo';
import { isTokenShape } from '@/lib/tokens';
import { invitePath } from '@/lib/urls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tu acceso · Stampa', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default async function ResetPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const info = isTokenShape(token) ? await getRepo().peekAccessToken(token) : null;
  if (info?.kind === 'invite') redirect(invitePath(token));

  if (!info) {
    return (
      <AuthShell title="Este enlace ya no sirve">
        <InvalidLinkBody mode="reset" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Cambia tu contraseña"
      subtitle={<span className="break-all">{info.email}</span>}
    >
      <SetPasswordForm token={token} mode="reset" email={info.email} />
    </AuthShell>
  );
}
