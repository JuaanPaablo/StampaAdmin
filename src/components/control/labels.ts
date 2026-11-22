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
    'customer.update': 'Datos de cliente',
    'staff.email': 'Correo del equipo',
    'staff.credentials': 'Acceso del equipo',
    'location.delete': 'Sucursal eliminada',
    'location.update': 'Sucursal actualizada',
    'business.update': 'Datos del negocio',
    'business.ready': 'Negocio activado',
    'business.create': 'Negocio creado',
    'business.access': 'Acceso autorizado',
    'business.plan': 'Plan actualizado',
    'business.suspend': 'Negocio suspendido',
    'business.reactivate': 'Negocio reactivado',
    'access.invite': 'Invitación enviada',
    'access.password': 'Contraseña creada',
    'access.reset': 'Contraseña restablecida'
  };
  return map[action] ?? 'Otra acción';
}
