import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { getTemplate } from '@/lib/templates';
import { demoCredentials } from '@/lib/auth';
import { roleLabel } from '@/components/shell/labels';
import { Wordmark } from '@/components/shell/logo';
import { LoginForm, type LoginBusiness } from './login-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ingresar · Stampa' };

export default async function IngresarPage() {
  const repo = getRepo();
  const businesses = await repo.listBusinesses();
  const data: LoginBusiness[] = await Promise.all(
    businesses.map(async (b) => {
      const vocab = getTemplate(b.type).vocab;
      const [staff, demo] = await Promise.all([repo.listStaff(b.id), demoCredentials(b.id)]);
      return {
        id: b.id,
        name: b.name,
        typeLabel: getTemplate(b.type).label,
        staff: staff.filter((s) => s.active && s.hasPin).map((s) => ({ id: s.id, name: s.name, role: roleLabel(s.role, vocab), pin: demo.find((d) => d.staffId === s.id)?.pin }))
      };
    })
  );

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex justify-center rounded-2xl bg-navy px-6 py-5">
          <Wordmark />
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line/70 sm:p-7">
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Ingresar al panel</h1>
          <p className="mt-1 text-sm text-muted">Elige tu negocio, tu nombre y escribe tu PIN de 4 dígitos.</p>
          <div className="mt-6">
            {data.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay negocios creados. <Link href="/registro" className="font-semibold text-navy underline">Crea el tuyo</Link>.</p>
            ) : (
              <LoginForm businesses={data} />
            )}
          </div>
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          ¿Aún no tienes tu negocio en Stampa?{' '}
          <Link href="/registro" className="font-semibold text-navy underline underline-offset-2">Crear mi negocio</Link>
        </p>
      </div>
    </main>
  );
}
