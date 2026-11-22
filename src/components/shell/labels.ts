import type { Plan, Role } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';

/** Etiquetas compartidas del shell. Seguras para componentes de cliente y de servidor. */
export function roleLabel(role: Role, vocab: Vocabulary): string {
  if (role === 'owner') return 'Dueño';
  if (role === 'manager') return 'Gerente';
  return vocab.staffRole.charAt(0).toUpperCase() + vocab.staffRole.slice(1);
}

export { PLAN_LABEL } from '@/lib/plans';

export const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/Guayaquil', label: 'Ecuador continental (Guayaquil)' },
  { value: 'Pacific/Galapagos', label: 'Galápagos' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Panama', label: 'Panamá' },
  { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { value: 'America/La_Paz', label: 'Bolivia (La Paz)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'America/New_York', label: 'Costa este de EE. UU. (Nueva York)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' }
];
