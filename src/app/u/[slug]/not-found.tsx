import Link from 'next/link';
import { Isotipo } from '@/components/shell/logo';
import { CustomerShell } from '@/components/customer/Shell';

export default function CustomerNotFound() {
  return (
    <CustomerShell>
      <div className="mt-10 rounded-3xl bg-navy px-6 py-10 text-center text-white shadow-card">
        <Isotipo size={56} className="mx-auto" />
        <h1 className="mt-5 font-display text-2xl font-bold">No encontramos esta tarjeta</h1>
        <p className="mt-2 text-[15px] text-white/85">Revisa que el enlace esté completo o vuelve a escanear el código del negocio.</p>
        <Link href="/mis-tarjetas" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-sun px-5 font-semibold text-navy hover:bg-sun-2">Ver mis tarjetas</Link>
      </div>
    </CustomerShell>
  );
}
