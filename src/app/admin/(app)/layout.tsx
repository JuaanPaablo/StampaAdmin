import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administración · Stampa', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { admin } = await requireAdmin();
  return (
    <div className="min-h-screen bg-surface">
      <AdminNav email={admin.email} />
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
