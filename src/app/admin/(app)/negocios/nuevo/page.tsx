import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { NewAccessForm } from '@/components/admin/NewAccessForm';
import { requireAdmin } from '@/lib/admin-session';
import { PLANS, PLAN_LABEL } from '@/lib/mvp-rules';

export const dynamic = 'force-dynamic';

export default async function NewAccessPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/negocios" className="mb-3 inline-flex items-center gap-1 rounded text-sm font-medium text-muted hover:text-navy">← Negocios</Link>
      <PageHeader title="Dar acceso a un negocio" subtitle="Escribe el correo del dueño. Le llegará un enlace para crear su contraseña." />
      <NewAccessForm plans={PLANS.map((p) => ({ value: p, label: PLAN_LABEL[p] }))} defaultPlan="negocio" />
    </>
  );
}
