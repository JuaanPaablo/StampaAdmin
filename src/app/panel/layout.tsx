import { Suspense, type ReactNode } from 'react';
import { getContext } from '@/lib/context';
import { isDemoMode } from '@/lib/demo';
import { NAV } from '@/lib/nav';
import { ShellNav } from '@/components/shell/shell-nav';
import { DemoSwitcher } from '@/components/shell/demo-switcher';
import { PrimerosPasos } from '@/components/shell/primeros-pasos';
import { roleLabel } from '@/components/shell/labels';
import { signOutAction } from '@/components/shell/actions';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const ctx = await getContext();
  const { repo, business, template, staff } = ctx;

  const items = NAV.filter((n) => n.roles.includes(staff.role)).map((n) => ({ href: n.href, label: n.label(template.vocab), icon: n.icon }));
  const showDemo = isDemoMode();
  const [businesses, team] = showDemo ? await Promise.all([repo.listBusinesses(), repo.listStaff(business.id)]) : [[], []];

  const footer = (
    <div className="rounded-xl bg-white/5 px-3.5 py-3">
      <p className="truncate text-sm font-semibold">{staff.name}</p>
      <p className="mt-0.5 text-xs text-white/65">{roleLabel(staff.role, template.vocab)}</p>
      <form action={signOutAction} className="mt-3">
        <button type="submit" className="h-9 w-full rounded-full bg-white/10 text-[13px] font-semibold text-white hover:bg-white/20">Salir</button>
      </form>
    </div>
  );

  return (
    <ShellNav
      items={items}
      businessName={business.name}
      typeLabel={template.label}
      footer={footer}
      demo={showDemo ? <DemoSwitcher businesses={businesses} staff={team} businessId={business.id} staffId={staff.id} /> : undefined}
    >
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
        <Suspense fallback={null}>
          <PrimerosPasos />
        </Suspense>
        {children}
      </main>
    </ShellNav>
  );
}
