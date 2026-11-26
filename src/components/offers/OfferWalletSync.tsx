'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import { syncOfferBatchAction } from '@/app/panel/cupones/actions';
import { plural } from './offer-form';

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'done'; total: number; notified: number; already: number }
  | { kind: 'error'; done: number; total: number; error: string; cursor: string | null };

/**
 * Actualiza el Wallet de los clientes de un cupón por tandas (syncOfferBatchAction, ~25 por llamada) mostrando el
 * progreso. 'send': pases + aviso "Nuevo cupón" (una vez por cliente). 'end': solo pases (salen terminados).
 * `autoStart`: corre al abrir (después de enviar o terminar). Siempre deja el botón "Volver a sincronizar".
 */
export function OfferWalletSync({ offerId, mode, autoStart, words }: {
  offerId: string;
  mode: 'send' | 'end';
  autoStart?: boolean;
  words: { customer: string; customers: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const started = useRef(false);

  async function run(fromCursor: string | null = null, doneBefore = 0, totalBefore = 0) {
    let cursor = fromCursor;
    let done = doneBefore;
    let total = totalBefore;
    let notified = 0;
    let already = 0;
    setPhase({ kind: 'running', done, total });
    for (let i = 0; i < 2000; i++) {
      const r = await syncOfferBatchAction(offerId, mode, cursor).catch(() => ({ ok: false as const, error: 'Se cortó la conexión. Vuelve a intentarlo: seguimos donde quedamos.' }));
      if (!r.ok) { setPhase({ kind: 'error', done, total, error: r.error, cursor }); return; }
      done += r.batch.processed;
      total = Math.max(r.batch.total, done);
      notified += r.batch.notified;
      already += r.batch.alreadyNotified;
      setPhase({ kind: 'running', done, total });
      if (!r.batch.nextCursor) break;
      cursor = r.batch.nextCursor;
    }
    setPhase({ kind: 'done', total, notified, already });
    router.refresh();
  }

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    // Se quita ?wallet=… de la dirección: recargar la página no vuelve a lanzar la sincronización sola.
    router.replace(pathname, { scroll: false });
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const running = phase.kind === 'running';
  const doing = mode === 'send' ? `Avisando a tus ${words.customers}…` : 'Actualizando los cupones en los celulares…';

  return (
    <div className="flex flex-col gap-2">
      <p role="status" aria-live="polite" className={cn('text-sm empty:hidden', phase.kind === 'error' ? 'text-bad' : phase.kind === 'done' ? 'text-good' : 'text-navy')}>
        {phase.kind === 'running' && (phase.total ? `${doing} ${phase.done} de ${phase.total}` : doing)}
        {phase.kind === 'done' && doneText(mode, phase, words)}
        {phase.kind === 'error' && `${phase.error}${phase.total ? ` (${phase.done} de ${phase.total} listos)` : ''}`}
      </p>
      {phase.kind === 'running' && phase.total > 0 && (
        <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface" aria-hidden>
          <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${Math.min(100, Math.round((phase.done / phase.total) * 100))}%` }} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {phase.kind === 'error' && (
          <button type="button" onClick={() => void run(phase.cursor, phase.done, phase.total)} className={btnClass('primary', 'sm')}>Reintentar</button>
        )}
        <button type="button" disabled={running} aria-busy={running} onClick={() => void run()} className={cn(btnClass('ghost', 'sm'), 'self-start')}>
          {running ? 'Sincronizando…' : 'Volver a sincronizar'}
        </button>
      </div>
    </div>
  );
}

function doneText(mode: 'send' | 'end', p: { total: number; notified: number; already: number }, words: { customer: string; customers: string }): string {
  if (p.total === 0) return mode === 'send' ? `No hay ${words.customers} con este cupón todavía.` : 'No quedaban cupones sin usar por actualizar.';
  const base = `Listo: actualizamos ${plural(p.total, words.customer, words.customers)}.`;
  if (mode === 'end') return `${base} El cupón ya aparece terminado en sus celulares.`;
  const parts = [base];
  if (p.notified) parts.push(`A ${plural(p.notified, 'persona', 'personas')} le${p.notified === 1 ? '' : 's'} llegó un aviso al celular.`);
  if (p.already) parts.push(`${plural(p.already, 'persona ya había', 'personas ya habían')} recibido el aviso antes.`);
  const rest = p.total - p.notified - p.already;
  if (rest > 0) parts.push(`${rest === 1 ? 'Otra persona lo verá' : `Otras ${rest} lo verán`} al abrir su tarjeta (no la tienen en el celular o ya recibieron 3 avisos hoy).`);
  return parts.join(' ');
}
