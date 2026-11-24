import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { MarketingStudio } from '@/components/marketing/MarketingStudio';
import { features } from '@/lib/plans';
import { imageQuotaOf, loadInsights, quotaOf } from '@/lib/marketing/service';
import { recommendStyles } from '@/lib/marketing/photos';
import { imageAiConfigured } from '@/lib/ai/fal';
import { stampaWhatsappUrl } from '@/lib/urls';

export const dynamic = 'force-dynamic';
// Mejorar una foto con IA tarda entre 10 y 40 s: las server actions de esta página necesitan más tiempo.
export const maxDuration = 60;
export const metadata = { title: 'Marketing · Stampa' };

export default async function MarketingPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const f = features(ctx.business.plan);
  const [quota, imageQuota, insights, photos] = await Promise.all([
    quotaOf(ctx), imageQuotaOf(ctx), f.dataPosts ? loadInsights(ctx) : Promise.resolve([]),
    ctx.repo.listMarketingPhotos(ctx.business.id, 24).catch(() => [])
  ]);
  // Sin FAL_KEY, en desarrollo se simula la mejora (copia la foto) para poder probar el flujo; en producción se avisa.
  const aiImagesReady = imageAiConfigured() || process.env.VERCEL_ENV !== 'production';
  const name = ctx.business.name;

  return (
    <>
      <PageHeader title="Marketing" />
      <MarketingStudio
        quota={quota}
        insights={insights}
        can={{ dataPosts: f.dataPosts, calendar: f.aiCalendar, reviews: f.aiReviews }}
        coverUrl={ctx.program.coverUrl || undefined}
        photos={photos}
        imageQuota={imageQuota}
        advice={recommendStyles(ctx.business.type)}
        aiImagesReady={aiImagesReady}
        moreUrl={stampaWhatsappUrl(`Hola, necesito más textos con IA en Stampa para ${name}`)}
        locks={{
          ideas: <PlanLock plan="standard" businessName={name} title="Ideas con tus datos"
            text="Posts con tus cifras reales: días flojos, premios y clientes nuevos." />,
          semana: <PlanLock plan="pro" businessName={name} title="Tu semana de posts"
            text="5 posts de lunes a viernes en un clic." />,
          resenas: <PlanLock plan="pro" businessName={name} title="Respuestas a reseñas de Google"
            text="Respuestas amables listas para publicar." />
        }}
      />
    </>
  );
}
