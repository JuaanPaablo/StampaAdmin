import type { CustomerSegment } from '@/lib/contracts';
import { Badge } from '@/components/ui';
import { segmentInfo } from './segments';

export function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  const s = segmentInfo(segment);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
