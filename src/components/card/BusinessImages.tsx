import { Card } from '@/components/ui';
import type { ImageFraming } from '@/lib/contracts';
import { ImageUpload } from './ImageUpload';

/** Logo y foto de portada del negocio. Lo usan el editor de tarjeta y el paso "Tu imagen" del asistente. */
export function BusinessImages({ logoUrl, coverUrl, logoText, framing, title = 'Logo y portada', intro }: {
  logoUrl?: string; coverUrl?: string; logoText: string; framing?: { logo?: ImageFraming; cover?: ImageFraming }; title?: string; intro?: string;
}) {
  return (
    <Card as="section" className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      </div>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ImageUpload kind="logo" label="Logo" currentUrl={logoUrl} fallback={logoText} framing={framing?.logo}
          help="Cuadrado, 500 × 500 px · máx. 2 MB" />
        <ImageUpload kind="cover" label="Foto de portada" currentUrl={coverUrl} framing={framing?.cover}
          help="Horizontal 3:1, 1500 × 500 px · máx. 2 MB" />
      </div>
    </Card>
  );
}
