import Link from 'next/link';
import QRCode from 'qrcode';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { btnClass, PageHeader } from '@/components/ui';
import { PosterSheet, type PosterSize } from '@/components/card/PosterSheet';
import { PrintButton } from '@/components/card/PrintButton';

export const dynamic = 'force-dynamic';

export default async function PosterPage({ searchParams }: { searchParams?: { tamano?: string } | Promise<{ tamano?: string }> }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, program, template } = ctx;

  const sp = (await Promise.resolve(searchParams)) ?? {};
  const size: PosterSize = sp.tamano?.toLowerCase() === 'a6' ? 'a6' : 'a4';
  const v = template.vocab;
  const signupUrl = `https://stampa.example/u/${business.slug}`;
  const qrSvg = await QRCode.toString(signupUrl, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#001D3D', light: '#FFFFFF' }
  });

  const tabClass = (active: boolean) => btnClass(active ? 'dark' : 'ghost', 'sm');

  return (
    <>
      <div data-noprint>
        <PageHeader
          title="Póster con QR"
          subtitle={`Imprímelo y ponlo en ${v.counter.toLowerCase()} o en la entrada. Tus ${v.customers} escanean, crean su tarjeta y empiezan a sumar.`}
          actions={<><Link href="/panel/tarjeta" className={btnClass('ghost')}>Volver a la tarjeta</Link><PrintButton /></>}
        />
        <nav aria-label="Tamaño del póster" className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Tamaño</span>
          <Link href="/panel/tarjeta/poster" aria-current={size === 'a4' ? 'page' : undefined} className={tabClass(size === 'a4')}>A4 (póster)</Link>
          <Link href="/panel/tarjeta/poster?tamano=a6" aria-current={size === 'a6' ? 'page' : undefined} className={tabClass(size === 'a6')}>A6 (tarjeta de mesa)</Link>
        </nav>
        <p className="mb-5 max-w-2xl text-xs text-muted">
          Al imprimir elige papel {size.toUpperCase()}, orientación vertical y escala al 100 %. Activa los gráficos de fondo para que se vean los colores.
        </p>
      </div>
      <PosterSheet
        size={size}
        businessName={business.name}
        logoText={program.logoText}
        logoUrl={program.logoUrl || undefined}
        colors={program.colors}
        slogan={`Cada ${v.visit} cuenta`}
        signupUrl={signupUrl}
        qrSvg={qrSvg}
        steps={['Escanea el código', 'Crea tu tarjeta en 20 segundos', `Suma un sello en cada ${v.visit}`]}
        rewardTitle={program.rewardTitle}
        stampsRequired={program.stampsRequired}
      />
    </>
  );
}
