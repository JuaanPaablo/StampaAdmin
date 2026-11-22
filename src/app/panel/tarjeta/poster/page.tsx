import Link from 'next/link';
import QRCode from 'qrcode';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { customerUrl } from '@/lib/urls';
import { btnClass, PageHeader } from '@/components/ui';
import { POSTER_FONTS_HREF, PosterSheet, type PosterSize } from '@/components/card/PosterSheet';
import { PlanLock } from '@/components/shell/PlanLock';
import { features } from '@/lib/plans';
import { PosterDesigner } from '@/components/card/PosterDesigner';
import { PrintButton } from '@/components/card/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Póster con QR · Stampa' };

export default async function PosterPage({ searchParams }: { searchParams?: { tamano?: string } | Promise<{ tamano?: string }> }) {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const { business, program } = ctx;

  const sp = (await Promise.resolve(searchParams)) ?? {};
  const size: PosterSize = sp.tamano?.toLowerCase() === 'a6' ? 'a6' : 'a4';
  // IMPORTANTE: el QR impreso depende de este formato (ver src/lib/urls.ts).
  const signupUrl = customerUrl(business.slug);
  const qrSvg = await QRCode.toString(signupUrl, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#001D3D', light: '#FFFFFF' }
  });

  const tabClass = (active: boolean) => btnClass(active ? 'dark' : 'ghost', 'sm');
  const canDesign = features(business.plan).posterDesign;
  const sheet = {
    size, businessName: business.name, logoText: program.logoText, logoUrl: program.logoUrl || undefined,
    logoFraming: program.imageFraming?.logo, colors: program.colors, signupUrl, qrSvg,
    rewardTitle: program.rewardTitle, stampsRequired: program.stampsRequired
  };

  return (
    <>
      <div data-noprint>
        <PageHeader
          title="Póster con QR"
          actions={<><Link href="/panel/tarjeta" className={btnClass('ghost')}>Volver</Link><PrintButton /></>}
        />
        <nav aria-label="Tamaño del póster" className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Tamaño</span>
          <Link href="/panel/tarjeta/poster" aria-current={size === 'a4' ? 'page' : undefined} className={tabClass(size === 'a4')}>A4 (póster)</Link>
          <Link href="/panel/tarjeta/poster?tamano=a6" aria-current={size === 'a6' ? 'page' : undefined} className={tabClass(size === 'a6')}>A6 (tarjeta de mesa)</Link>
        </nav>
        <ul className="mb-5 flex max-w-2xl flex-col gap-1 text-xs text-muted">
          <li>QR: <a href={signupUrl} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-navy underline underline-offset-4">{signupUrl}</a> · pruébalo antes de imprimir.</li>
          <li>Impresión: {size.toUpperCase()}, vertical, escala 100 % y gráficos de fondo activados.</li>
        </ul>
      </div>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={POSTER_FONTS_HREF} />
      {canDesign ? (
        <PosterDesigner initial={program.poster} sheet={sheet} />
      ) : (
        <div className="flex flex-col gap-5">
          <div data-noprint>
            <PlanLock plan="standard" businessName={business.name} title="Diseña tu póster"
              text="Tus colores, tu letra y tu título." />
          </div>
          <PosterSheet {...sheet} />
        </div>
      )}
    </>
  );
}
