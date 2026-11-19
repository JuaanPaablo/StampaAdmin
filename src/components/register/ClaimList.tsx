import { Badge } from '@/components/ui';
import type { StampClaim } from '@/lib/contracts';
import { voidClaimAction } from '@/app/panel/caja/actions';
import { ActionButton } from './ActionButton';
import { clock } from './time';

/** Reclamos del código, del más reciente al más antiguo. La región es aria-live para anunciar nuevos reclamos. */
export function ClaimList({ codeId, claims, timezone, customerWord, canVoid }: {
  codeId: string; claims: StampClaim[]; timezone: string; customerWord: string; canVoid: boolean;
}) {
  const sorted = [...claims].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div aria-live="polite" aria-relevant="additions text">
      {sorted.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">
          Aún nadie reclama. Cuando un {customerWord} escanee o digite el código, aparece aquí al instante.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0">
                <p className={'truncate text-[15px] font-semibold ' + (c.voidedAt ? 'text-muted line-through' : 'text-navy')}>{c.customerName}</p>
                <p className="text-xs text-muted tabular-nums">
                  {clock(c.at, timezone)}
                  {c.voidedAt && <span className="ml-2"><Badge tone="bad">Anulado {clock(c.voidedAt, timezone)}</Badge></span>}
                </p>
              </div>
              {!c.voidedAt && canVoid && (
                <ActionButton action={voidClaimAction} fields={{ codeId, claimId: c.id }} label="Anular" confirmLabel="Sí, anular sello" variant="danger" size="sm"
                  confirmQuestion="El sello se quita de la tarjeta y el cupo no se devuelve." pendingText="Anulando…" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
