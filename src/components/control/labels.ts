import type { Vocabulary } from '@/lib/templates';
import type { AlertKind, Severity } from '@/lib/contracts';

/** Nombre de cada nivel de alerta. El mismo en Inicio y en Control. */
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Urgente', warning: 'Revisar', info: 'Aviso' };

/** Tono de Badge para cada nivel. */
export const SEVERITY_TONE: Record<Severity, 'bad' | 'warn' | 'info'> = { critical: 'bad', warning: 'warn', info: 'info' };

/** Qué hacer con cada tipo de alerta, en una línea. `t` es la palabra del ticket en minúscula (ticket, comanda, factura…). */
export function alertAdvice(kind: AlertKind, t: string): string {
  switch (kind) {
    case 'staff_ratio': return `Revisa sus ${t}s recientes y pregúntale por qué da más sellos que el resto.`;
    case 'shared_code': return 'Alguien quiso usar el código cuando ya estaba usado. Recuerda al equipo mostrarlo solo al cliente que pagó.';
    case 'approval': return 'Solo para que estés al tanto. Confirma que quien aprobó estaba presente.';
    case 'voids': return 'Pregunta por qué se anularon. Si se repite, revisa esos códigos.';
    case 'duplicate_ticket': return `Cada ${t} da un solo código. Habla con esa persona si se repite.`;
    case 'cooldown': return 'No tienes que hacer nada: Stampa no dio el sello.';
    default: return '';
  }
}

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
