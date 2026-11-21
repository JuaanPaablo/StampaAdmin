import { Card } from '@/components/ui';
import { ImageUpload } from './ImageUpload';

/** Logo y foto de portada del negocio. Lo usan el editor de tarjeta y el paso "Tu imagen" del asistente. */
export function BusinessImages({ logoUrl, coverUrl, logoText, title = 'Logo y portada', intro }: {
  logoUrl?: string; coverUrl?: string; logoText: string; title?: string; intro?: string;
}) {
  return (
    <Card as="section" className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        <p className="mt-1 text-sm text-muted">{intro ?? 'Se ven en la tarjeta de tus clientes y en tu póster QR. Si no subes un logo, usamos tus iniciales.'}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ImageUpload kind="logo" label="Logo" currentUrl={logoUrl} fallback={logoText}
          help="Cuadrado, PNG, JPG o WEBP. Máximo 2 MB." />
        <ImageUpload kind="cover" label="Foto de portada" currentUrl={coverUrl}
          help="Horizontal, por ejemplo tu local o tu producto estrella. PNG, JPG o WEBP. Máximo 2 MB." />
      </div>
    </Card>
  );
}
