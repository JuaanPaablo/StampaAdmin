import Link from 'next/link';
import { Badge, EmptyState, Table, Td, Th } from '@/components/ui';
import type { CodeStatus, StampCode } from '@/lib/contracts';
import { ago, money } from '@/lib/format';
import { StatusBadge } from '@/components/register/StatusBadge';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Intentos extra": veces que alguien quiso usar el código ya completo o vencido. Se marca con texto y no solo en rojo. */
function Extra({ n }: { n: number }) {
  return n > 0 ? <Badge tone="bad"><span aria-hidden="true">⚠&nbsp;</span>{n}</Badge> : <span className="text-muted">0</span>;
}

/**
 * Últimos códigos. En el celular es una lista de tarjetas (se lee a 360 px); desde `sm` es una tabla.
 */
export function CodesTable({ codes, statuses, staffNames, showAmount, ticketWord, staffWord }: {
  codes: StampCode[]; statuses: Record<string, CodeStatus>; staffNames: Record<string, string>; showAmount: boolean; ticketWord: string; staffWord: string;
}) {
  if (codes.length === 0) {
    return <EmptyState title="Aún no hay códigos" text="Aparecen aquí cuando tu equipo da sellos en caja." />;
  }
  const anyExtra = codes.some((c) => c.attempts > 0);
  const approver = (c: StampCode) => (c.approvedBy ? staffNames[c.approvedBy] ?? 'Sí' : null);
  return (
    <>
      <ul aria-label="Últimos códigos" className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line/70 sm:hidden">
        {codes.map((c) => (
          <li key={c.id}>
            <Link href={'/panel/caja/' + c.id} className="block px-4 py-3 hover:bg-surface/70">
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-navy underline underline-offset-2">{ticketWord} {c.ticket}</span>
                <StatusBadge status={statuses[c.id]} />
              </span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{staffNames[c.createdBy] ?? '—'}</span>
                <span>{c.claims.length} de {c.seats} sellos</span>
                {showAmount && c.amountCents > 0 && <span>{money(c.amountCents)}</span>}
                {approver(c) && <span>Aprobó {approver(c)}</span>}
                <span>{ago(c.createdAt)}</span>
              </span>
              {c.attempts > 0 && (
                <span className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-[#9B2A22]">
                  <Extra n={c.attempts} /> {c.attempts === 1 ? 'intento extra' : 'intentos extra'}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <Table className="hidden sm:block">
        <caption className="sr-only">Últimos códigos</caption>
        <thead>
          <tr>
            <Th>{ticketWord}</Th><Th>{cap(staffWord)}</Th>{showAmount && <Th className="text-right">Monto</Th>}
            <Th className="text-right">Sellos dados</Th><Th>Aprobó con PIN</Th><Th className="text-right">Intentos extra</Th><Th>Estado</Th><Th>Creado</Th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.id}>
              <Td className="whitespace-nowrap font-semibold"><Link href={'/panel/caja/' + c.id} className="underline underline-offset-2">{c.ticket}</Link></Td>
              <Td>{staffNames[c.createdBy] ?? '—'}</Td>
              {showAmount && <Td className="text-right">{c.amountCents > 0 ? money(c.amountCents) : '—'}</Td>}
              <Td className="whitespace-nowrap text-right">{c.claims.length} de {c.seats}</Td>
              <Td>{approver(c) ?? <span className="text-muted">No hizo falta</span>}</Td>
              <Td className="text-right"><Extra n={c.attempts} /></Td>
              <Td><StatusBadge status={statuses[c.id]} /></Td>
              <Td className="whitespace-nowrap text-xs text-muted">{ago(c.createdAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {anyExtra && (
        <p className="mt-3 text-xs text-muted">
          <b className="text-navy">Intentos extra:</b> alguien quiso usar el código cuando ya estaba completo. Puede que se haya compartido fuera del local.
        </p>
      )}
    </>
  );
}
