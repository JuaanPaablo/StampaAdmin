import type { CustomerSegment } from '@/lib/contracts';

/** `hint`: regla del segmento en palabras del negocio (coincide con segmentOf en src/lib/domain). */
export const SEGMENTS: { key: CustomerSegment; label: string; tone: 'info' | 'ok' | 'warn' | 'neutral' | 'sun'; hint: string }[] = [
  { key: 'nuevo', label: 'Nuevo', tone: 'info', hint: 'Se registraron hace menos de 14 días.' },
  { key: 'activo', label: 'Activo', tone: 'ok', hint: 'Vinieron en los últimos 21 días.' },
  { key: 'en_riesgo', label: 'En riesgo', tone: 'warn', hint: 'Llevan de 21 a 45 días sin venir. Buen momento para escribirles.' },
  { key: 'inactivo', label: 'Inactivo', tone: 'neutral', hint: 'Llevan más de 45 días sin venir.' },
  { key: 'por_canjear', label: 'Por canjear', tone: 'sun', hint: 'Tienen un premio listo. Entrégalo en su próxima visita.' }
];

export const SEGMENT_KEYS = SEGMENTS.map((s) => s.key);
export const segmentInfo = (k: CustomerSegment) => SEGMENTS.find((s) => s.key === k) ?? SEGMENTS[1];
export const SORTS = [
  { key: 'recientes', label: 'Más recientes' },
  { key: 'sellos', label: 'Más sellos' },
  { key: 'nombre', label: 'Nombre (A a Z)' },
  { key: 'inactividad', label: 'Más tiempo sin venir' }
] as const;
