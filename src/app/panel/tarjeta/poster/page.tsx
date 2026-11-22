import Link from 'next/link';
import QRCode from 'qrcode';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { customerUrl } from '@/lib/urls';
import { btnClass, PageHeader } from '@/components/ui';
import { POSTER_FONTS_HREF, type PosterSize } from '@/components/card/PosterSheet';
import { PosterDesigner } from '@/components/card/PosterDesigner';
import { PrintButton } from '@/components/card/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Póster con QR · Stampa' };

export default async function PosterPage({ searchParams }: { searchParams?: { tamano?: string } | Promise<{ tamano?: string }> }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, program, template } = ctx;

  const sp = (await Promise.resolve(searchParams)) ?? {};
  const size: PosterSize = sp.tamano?.toLowerCase() === 'a6' ? 'a6' : 'a4';
  const v = template.vocab;
  // IMPORTANTE: el QR impreso depende de este formato (ver src/lib/urls.ts).
  const signupUrl = customerUrl(business.slug);
  const qrSvg = await QRCode.toString(signupUrl, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#001D3D', light: '#FFFFFF' }
  });

  const tabClass = (active: boolean) => btnClass(active ? 'dark' : 'ghost', 'sm');

  return (
    <>
      <div data-noprint>
        <PageHeader
          title="Póster con QR"
          subtitle={`Imprímelo y ponlo en ${v.counter.toLowerCase()} o en la entrada. Tus ${v.customers} lo escanean, crean su tarjeta y empiezan a sumar sellos.`}
          actions={<><Link href="/panel/tarjeta" className={btnClass('ghost')}>Volver a la tarjeta</Link><PrintButton /></>}
        />
        <nav aria-label="Tamaño del póster" className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Tamaño</span>
          <Link href="/panel/tarjeta/poster" aria-current={size === 'a4' ? 'page' : undefined} className={tabClass(size === 'a4')}>A4 (póster)</Link>
          <Link href="/panel/tarjeta/poster?tamano=a6" aria-current={size === 'a6' ? 'page' : undefined} className={tabClass(size === 'a6')}>A6 (tarjeta de mesa)</Link>
        </nav>
        <p className="mb-2 max-w-2xl text-sm text-navy">
          El QR abre <a href={signupUrl} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline underline-offset-4">{signupUrl}</a>. Pruébalo con tu teléfono antes de imprimir.
        </p>
        <p className="mb-5 max-w-2xl text-xs text-muted">
          Al imprimir elige papel {size.toUpperCase()}, orientación vertical y escala al 100 %. Activa los gráficos de fondo para que se vean los colores.
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={POSTER_FONTS_HREF} />
      <PosterDesigner initial={program.poster} sheet={{
        size, businessName: business.name, logoText: program.logoText, logoUrl: program.logoUrl || undefined,
        logoFraming: program.imageFraming?.logo, colors: program.colors, signupUrl, qrSvg,
        rewardTitle: program.rewardTitle, stampsRequired: program.stampsRequired
      }} />
    </>
  );
}
