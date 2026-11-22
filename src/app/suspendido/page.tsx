import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/context';
import { businessStatus } from '@/lib/mvp-rules';
import { STAMPA_WHATSAPP_DISPLAY, stampaWhatsappUrl } from '@/lib/urls';
import { btnClass } from '@/components/ui';
import { Isotipo, Wordmark } from '@/components/shell/logo';
import { signOutAction } from '@/components/shell/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cuenta pausada · Stampa' };

/** Pantalla del dueño y su equipo cuando Stampa suspendió el negocio. Solo con sesión y negocio suspendido. */
export default async function SuspendidoPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/ingresar');
  if (businessStatus(ctx.business) !== 'suspended') redirect('/panel');
  const { business, staff } = ctx;
  const isOwner = staff.role === 'owner';

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-4 py-10 text-white">
      <Isotipo size={420} color="#0F2A4A" dot="#0F2A4A" className="pointer-events-none absolute -bottom-24 -right-28 opacity-70" />
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex justify-center"><Wordmark /></div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">Tu cuenta está pausada</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#C9D6E3]">
          <span className="font-semibold text-white">{business.name}</span>: tus clientes no pueden sumar sellos por ahora.{' '}
          {isOwner ? 'Escríbenos y la reactivamos.' : 'Avísale al dueño o escríbenos.'}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <a href={stampaWhatsappUrl(`Hola, quiero reactivar mi cuenta de Stampa de ${business.name}`)} target="_blank" rel="noopener noreferrer"
              className={btnClass('primary') + ' h-12 text-base'}>
              Escríbenos por WhatsApp
            </a>
          <form action={signOutAction}>
            <button type="submit" className="h-12 w-full rounded-full text-sm font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-white/10">Cerrar sesión</button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-[#8DA2B8]">WhatsApp {STAMPA_WHATSAPP_DISPLAY}</p>
      </div>
    </main>
  );
}
