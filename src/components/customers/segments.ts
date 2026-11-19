import type { CustomerSegment } from '@/lib/contracts';

export const SEGMENTS: { key: CustomerSegment; label: string; tone: 'info' | 'ok' | 'warn' | 'neutral' | 'sun' }[] = [
  { key: 'nuevo', label: 'Nuevo', tone: 'info' },
  { key: 'activo', label: 'Activo', tone: 'ok' },
  { key: 'en_riesgo', label: 'En riesgo', tone: 'warn' },
  { key: 'inactivo', label: 'Inactivo', tone: 'neutral' },
  { key: 'por_canjear', label: 'Por canjear', tone: 'sun' }
];

export const SEGMENT_KEYS = SEGMENTS.map((s) => s.key);
export const segmentInfo = (k: CustomerSegment) => SEGMENTS.find((s) => s.key === k) ?? SEGMENTS[1];
export const SORTS = [
  { key: 'recientes', label: 'Más recientes' },
  { key: 'sellos', label: 'Más sellos' },
  { key: 'nombre', label: 'Nombre (A a Z)' },
  { key: 'inactividad', label: 'Más tiempo sin venir' }
] as const;
