import type { Offer } from '@/lib/contracts';
import { offerStatusLabel } from '@/lib/domain/wallet-cards';
import { Badge } from '@/components/ui';

const TONE: Record<string, 'neutral' | 'info' | 'ok' | 'warn' | 'bad'> = {
  Borrador: 'neutral', Programado: 'info', Vigente: 'ok', Vencido: 'warn', Terminado: 'bad'
};

/** Estado del cupón: Borrador, Programado, Vigente, Vencido o Terminado. */
export function OfferStatusBadge({ offer, now }: { offer: Pick<Offer, 'status' | 'startsAt' | 'endsAt'>; now?: number }) {
  const label = offerStatusLabel(offer, now);
  return <Badge tone={TONE[label] ?? 'neutral'}>{label}</Badge>;
}
