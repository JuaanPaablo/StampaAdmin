import { Card, PageHeader } from '@/components/ui';
import { ChangePasswordForm } from '@/components/admin/ChangePasswordForm';
import { formatDate } from '@/components/admin/helpers';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export default async function AdminAccountPage() {
  const { admin } = await requireAdmin();
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={admin.email} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <Card>
          <h2 className="mb-4 font-display text-base font-semibold text-navy">Cambiar contraseña</h2>
          <ChangePasswordForm email={admin.email} />
        </Card>
        <Card className="self-start">
          <h2 className="mb-2 font-display text-base font-semibold text-navy">Tu acceso</h2>
          <p className="text-sm text-muted">Cuenta creada el {formatDate(admin.createdAt)}.</p>
          <p className="mt-3 text-sm text-muted">
            La sesión dura 12 horas. Si olvidas tu contraseña, pídele a quien administra el servidor que la restablezca con{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-navy">npm run admin:create</code>.
          </p>
        </Card>
      </div>
    </>
  );
}
