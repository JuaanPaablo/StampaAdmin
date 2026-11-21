import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { AuthShell } from '@/components/admin/AuthShell';
import { getAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administración · Stampa', robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin');
  return (
    <AuthShell title="Entrar a la administración" subtitle="Solo para el equipo de Stampa." tag="Administración">
      <AdminLoginForm />
    </AuthShell>
  );
}
