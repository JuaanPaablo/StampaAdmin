import Link from 'next/link';
import { Wordmark } from '@/components/shell/logo';
import { TEMPLATES } from '@/lib/templates';
import type { BusinessType } from '@/lib/contracts';
import { RegistroWizard } from './wizard';

export const metadata = { title: 'Crear mi negocio · Stampa' };

export default function RegistroPage({ searchParams }: { searchParams: { tipo?: string } }) {
  const tipo = searchParams.tipo && searchParams.tipo in TEMPLATES ? (searchParams.tipo as BusinessType) : undefined;
  return (
    <main className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-[1000px]">
        <header className="mb-6 flex items-center justify-between rounded-2xl bg-navy px-5 py-4">
          <Wordmark />
          <Link href="/ingresar" className="rounded-full px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10">Ya tengo cuenta</Link>
        </header>
        <RegistroWizard initialType={tipo} />
      </div>
    </main>
  );
}
