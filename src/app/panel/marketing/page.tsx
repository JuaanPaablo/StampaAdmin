import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { PlanLock } from '@/components/shell/PlanLock';
import { MarketingStudio } from '@/components/marketing/MarketingStudio';
import { features } from '@/lib/plans';
import { loadInsights, quotaOf } from '@/lib/marketing/service';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketing · Stampa' };

export default async function MarketingPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner', 'manager']);
  const f = features(ctx.business.plan);
  const [quota, insights] = await Promise.all([quotaOf(ctx), f.dataPosts ? loadInsights(ctx) : Promise.resolve([])]);
  const name = ctx.business.name;

  return (
    <>
      <PageHeader title="Marketing" subtitle="Posts para tus redes con tu marca y tus datos reales. Tú revisas, copias y publicas." />
      <MarketingStudio
        quota={quota}
        insights={insights}
        can={{ dataPosts: f.dataPosts, calendar: f.aiCalendar, reviews: f.aiReviews }}
        hasCover={!!ctx.program.coverUrl}
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
