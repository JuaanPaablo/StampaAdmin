import Link from 'next/link';
import { EmptyState, Table, Td, Th } from '@/components/ui';
import type { CodeStatus, StampCode } from '@/lib/contracts';
import { ago, money } from '@/lib/format';
import { StatusBadge } from '@/components/register/StatusBadge';

export function CodesTable({ codes, statuses, staffNames, showAmount, ticketWord, staffWord }: {
  codes: StampCode[]; statuses: Record<string, CodeStatus>; staffNames: Record<string, string>; showAmount: boolean; ticketWord: string; staffWord: string;
}) {
  if (codes.length === 0) {
    return <EmptyState title="Aún no hay códigos"/>;
  }
  return (
    <Table>
      <caption className="sr-only">Códigos recientes</caption>
      <thead>
        <tr>
          <Th>{ticketWord}</Th><Th>Persona</Th>{showAmount && <Th className="text-right">Monto</Th>}
          <Th className="text-right">Cupos</Th><Th>Aprobado por</Th><Th className="text-right">Rechazos</Th><Th>Estado</Th><Th>Creado</Th>
        </tr>
      </thead>
      <tbody>
        {codes.map((c) => (
          <tr key={c.id}>
            <Td className="whitespace-nowrap font-semibold"><Link href={'/panel/caja/' + c.id} className="underline underline-offset-2">{c.ticket}</Link></Td>
            <Td>{staffNames[c.createdBy] ?? '—'}</Td>
            {showAmount && <Td className="text-right">{c.amountCents > 0 ? money(c.amountCents) : '—'}</Td>}
            <Td className="text-right">{c.claims.length}/{c.seats}</Td>
            <Td>{c.approvedBy ? staffNames[c.approvedBy] ?? 'Sí' : <span className="text-muted">No requirió</span>}</Td>
            <Td className={'text-right ' + (c.attempts > 0 ? 'font-bold text-bad' : '')}>{c.attempts}</Td>
            <Td><StatusBadge status={statuses[c.id]} /></Td>
            <Td className="whitespace-nowrap text-xs text-muted">{ago(c.createdAt)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
