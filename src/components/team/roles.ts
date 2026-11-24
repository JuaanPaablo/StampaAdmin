import type { Role } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nombre visible del rol. El rol 'cashier' usa el vocabulario de la plantilla (cajero, recepcionista, vendedor...). */
export function roleLabel(role: Role, vocab: Vocabulary): string {
  if (role === 'owner') return 'Dueño';
  if (role === 'manager') return 'Gerente';
  return cap(vocab.staffRole);
}

export function roleDescription(role: Role, vocab: Vocabulary): string {
  if (role === 'owner') return 'Controla todo el negocio.';
  if (role === 'manager') return 'Administra el día a día.';
  return `Atiende en ${vocab.counter.toLowerCase()} y da sellos.`;
}

/** Qué puede hacer el rol, en una línea, para elegirlo sin tener que recordar la matriz de permisos. */
export function roleSummary(role: Role, vocab: Vocabulary): string {
  if (role === 'owner') return 'Acceso total: equipo, ajustes y plan.';
  if (role === 'manager') return `${vocab.counter}, resumen, clientes, tarjeta y marketing. Aprueba cupos con su PIN. Sin equipo ni ajustes.`;
  return `Solo ${vocab.counter.toLowerCase()}: da sellos y canjea premios.`;
}

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'sun';
export const roleTone: Record<Role, BadgeTone> = { owner: 'info', manager: 'warn', cashier: 'neutral' };
