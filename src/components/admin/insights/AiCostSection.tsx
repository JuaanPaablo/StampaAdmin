import Link from 'next/link';
import type { AdminInsights } from '@/lib/contracts';
import { ecDateLabel } from '@/lib/domain/admin-insights';
import { PLAN_LABEL } from '@/lib/plans';
import { Badge, Card, EmptyState, Table, Td, Th } from '@/components/ui';
import { KpiCard } from '@/components/dashboard';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { SectionHeader, countText, focusRing } from './bits';
import { AI_RATIO_WARN, aiRatioWarn, formatRatio, formatUsd } from './helpers';

/** Costo estimado de la IA del mes por negocio, contra el precio de su plan. */
export function AiCostSection({ ai }: { ai: AdminInsights['ai'] }) {
  const rows = ai.businesses;
  const warn = rows.filter((r) => aiRatioWarn(r.ratio)).length;
  const texts = rows.reduce((a, r) => a + r.texts, 0);
  const images = rows.reduce((a, r) => a + r.images, 0);
  return (
    <section aria-labelledby="ia">
      <SectionHeader id="ia" title="Costo de la IA" text={`Desde el ${ecDateLabel(ai.since)}. Precios estimados según el uso de textos y fotos.`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Costo este mes" value={formatUsd(ai.totalCostUsd)} hint="En dólares, estimado" />
        <KpiCard label="Negocios que usan IA" value={num(rows.length)} hint={`${num(texts)} textos · ${num(images)} fotos`} />
        <KpiCard label="Con costo alto" value={num(warn)} hint={`IA sobre el ${Math.round(AI_RATIO_WARN * 100)} % del plan`} />
      </div>
      <div className="mt-3 sm:mt-4">
        {rows.length === 0 ? (
          <EmptyState title="Sin uso de IA este mes" text="Cuando un negocio genere textos o mejore fotos, verás aquí su costo." />
        ) : (
          <Table label="Costo de la IA por negocio">
            <caption className="sr-only">Costo estimado de la IA por negocio este mes, del más caro al más barato.</caption>
            <thead>
              <tr>
                <Th>Negocio</Th><Th className="text-right">Textos</Th><Th className="text-right">Fotos</Th>
                <Th className="text-right">Costo</Th><Th className="text-right">Plan</Th><Th className="text-right">% del plan</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const high = aiRatioWarn(r.ratio);
                return (
                  <tr key={r.businessId} className={high ? 'bg-[#FFFBEB]' : undefined}>
                    <Td className="max-w-[220px]">
                      <Link href={`/admin/negocios/${r.businessId}`} className={cn('block truncate rounded font-semibold text-navy underline-offset-2 hover:underline', focusRing)}>{r.businessName}</Link>
                    </Td>
                    <Td className="text-right">{num(r.texts)}</Td>
                    <Td className="text-right">{num(r.images)}</Td>
                    <Td className="text-right font-semibold">{formatUsd(r.costUsd)}</Td>
                    <Td className="whitespace-nowrap text-right text-muted">{PLAN_LABEL[r.plan]} · ${num(r.planPriceUsd, 2)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      {high ? <Badge tone="warn"><span aria-hidden="true">▲&nbsp;</span>{formatRatio(r.ratio)}<span className="sr-only">: costo alto</span></Badge> : formatRatio(r.ratio)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Card as="div" className="mt-3 !p-4 text-xs text-muted">
          <strong className="text-navy">Precios estimados.</strong> Calculados con las tarifas públicas de los proveedores (textos y fotos), no con la factura real.
          {' '}Se marca en amarillo cuando la IA pasa del {Math.round(AI_RATIO_WARN * 100)} % del precio del plan{warn ? ` (${countText(warn, 'negocio', 'negocios')})` : ''}.
        </Card>
      </div>
    </section>
  );
}
