import Link from 'next/link';
import { PageHeader, btnClass } from '@/components/ui';
import {
  AiCostSection, GrowthSection, HealthSection, MoneySection, PlatformSection, TaskList,
  ecGreeting, ecLongDate, parseDaysRange
} from '@/components/admin/insights';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export default async function AdminSummaryPage({ searchParams }: { searchParams?: { rango?: string | string[] } }) {
  const { repo } = await requireAdmin();
  const range = parseDaysRange(searchParams?.rango);
  const [insights, summary] = await Promise.all([repo.getAdminInsights(), repo.getPlatformSummary()]);
  const now = Date.parse(insights.generatedAt) || Date.now();

  return (
    <>
      <PageHeader
        title={ecGreeting(now)}
        subtitle={`${ecLongDate(now)}. Esto es lo que pasa hoy en Stampa.`}
        actions={<Link href="/admin/negocios/nuevo" className={btnClass('primary')}>Dar acceso a un negocio</Link>}
      />
      <div className="flex flex-col gap-10">
        <TaskList tasks={insights.tasks} />
        <MoneySection money={insights.money} />
        <HealthSection health={insights.health} ranking={insights.ranking} />
        <GrowthSection series={insights.series} range={range} />
        <PlatformSection summary={summary} />
        <AiCostSection ai={insights.ai} />
      </div>
    </>
  );
}
