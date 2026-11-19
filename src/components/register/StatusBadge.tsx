import { Badge } from '@/components/ui';
import type { CodeStatus } from '@/lib/contracts';

const MAP: Record<CodeStatus, { label: string; tone: 'ok' | 'info' | 'warn' | 'bad' }> = {
  activo: { label: 'Activo', tone: 'ok' },
  agotado: { label: 'Completo', tone: 'info' },
  vencido: { label: 'Vencido', tone: 'warn' },
  cancelado: { label: 'Cancelado', tone: 'bad' }
};

export function StatusBadge({ status }: { status: CodeStatus }) {
  const m = MAP[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
