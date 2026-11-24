import { Card, EmptyState } from '@/components/ui';
import type { CustomerRow, Milestone, Redemption } from '@/lib/contracts';
import { pendingRewards } from '@/lib/rewards';
import { ago } from '@/lib/format';
import { redeemAction } from '@/app/panel/caja/actions';
import { ActionButton } from './ActionButton';

/** "Listos para canjear" y últimos canjes. Ancla #premios. */
export function RewardsSection({ redeemable, redemptions, stampsRequired, rewardTitle, milestones, vocab, staffNames }: {
  redeemable: CustomerRow[]; redemptions: Redemption[]; stampsRequired: number; rewardTitle: string; milestones?: Milestone[];
  vocab: { customer: string; customers: string; reward: string }; staffNames: Record<string, string>;
}) {
  return (
    <section id="premios" aria-labelledby="premios-h" className="scroll-mt-6">
      <h2 id="premios-h" className="mb-3 font-display text-lg font-semibold text-navy">Listos para canjear</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-navy">Pendientes <span className="rounded-full bg-surface px-2 py-0.5 text-xs tabular-nums text-muted">{redeemable.length}</span></h3>
          {redeemable.length === 0 ? (
            <EmptyState title={'Ningún ' + vocab.reward + ' pendiente'} />
          ) : (
            <ul className="divide-y divide-line">
              {redeemable.flatMap((c) => pendingRewards(c, { stampsRequired, rewardTitle, milestones }).map((p) => (
                <li key={c.id + ':' + (p.milestone ?? 'final')} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-navy">{c.name}</p>
                    <p className="text-xs text-muted">{p.title} · {p.milestone ? `sello ${p.milestone}` : `${c.stamps} de ${stampsRequired} sellos`}</p>
                  </div>
                  {/* Canjear no se puede deshacer: pide un segundo toque. El aviso sale en <FlashRegion /> porque la fila desaparece. */}
                  <ActionButton action={redeemAction} fields={p.milestone ? { customerId: c.id, milestone: String(p.milestone) } : { customerId: c.id }}
                    label="Canjear" confirmLabel="Sí, entregar" confirmQuestion={'¿Entregar ' + p.title + ' a ' + c.name + '?'} pendingText="Canjeando…" broadcast />
                </li>
              )))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-navy">Últimos canjes</h3>
          {redemptions.length === 0 ? (
            <p className="py-4 text-sm text-muted">Sin canjes todavía.</p>
          ) : (
            <ul className="divide-y divide-line">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-navy">{r.customerName}{r.rewardTitle ? <span className="font-normal text-muted"> · {r.rewardTitle}</span> : null}</span>
                  <span className="shrink-0 text-xs text-muted">{ago(r.at)}{staffNames[r.staffId] ? ' · ' + staffNames[r.staffId] : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
