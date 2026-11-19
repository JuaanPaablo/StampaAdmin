import type { Vocabulary } from '@/lib/templates';

/** Etiquetas legibles de las acciones del registro de actividad. El vocabulario sale de la plantilla. */
export function auditLabel(action: string, v: Pick<Vocabulary, 'reward' | 'ticket'>): string {
  const reward = v.reward;
  const map: Record<string, string> = {
    'code.create': 'Código generado',
    'code.cancel': 'Código cancelado',
    'code.approve': 'Aprobación con PIN',
    'claim.create': 'Sello reclamado',
    'claim.void': 'Sello anulado',
    'redeem': reward.charAt(0).toUpperCase() + reward.slice(1) + ' canjeado',
    'program.update': 'Reglas de la tarjeta',
    'staff.update': 'Equipo actualizado',
    'staff.create': 'Integrante agregado',
    'customer.update': 'Datos de cliente'
  };
  return map[action] ?? action;
}
