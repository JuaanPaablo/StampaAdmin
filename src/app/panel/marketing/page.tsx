import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { MarketingStudio } from '@/components/marketing/MarketingStudio';
import { features } from '@/lib/plans';
import { imageQuotaOf, loadInsights, quotaOf } from '@/lib/marketing/service';
import { recommendStyles } from '@/lib/marketing/photos';
import { imageAiConfigured } from '@/lib/ai/fal';

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
      <PageHeader title="Marketing" subtitle="Posts listos para tus redes: tu foto mejorada, tu marca y un texto que vende. Tú revisas, copias y publicas." />
      <MarketingStudio
        quota={quota}
        insights={insights}
        can={{ dataPosts: f.dataPosts, calendar: f.aiCalendar, reviews: f.aiReviews }}
        coverUrl={ctx.program.coverUrl || undefined}
        photos={photos}
        imageQuota={imageQuota}
        advice={recommendStyles(ctx.business.type)}
        aiImagesReady={aiImagesReady}
        locks={{
          ideas: <PlanLock plan="standard" businessName={name} title="Ideas con tus datos"
            text="Stampa mira tus días flojos, premios entregados y clientes nuevos, y te propone posts listos con esas cifras." />,
          semana: <PlanLock plan="pro" businessName={name} title="Tu semana de posts"
            text="Cinco publicaciones de lunes a viernes, armadas con tus datos, en un solo clic." />,
          resenas: <PlanLock plan="pro" businessName={name} title="Respuestas a reseñas de Google"
            text="Pega una reseña y recibe respuestas amables y profesionales para publicarlas." />
        }}
      />
    </>
  );
}
