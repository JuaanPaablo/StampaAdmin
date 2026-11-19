import type { Role, Staff } from '@/lib/contracts';

/** Reglas de equipo, puras y sin base de datos. Las usan las acciones del servidor. */
export function checkStaffChange(a: {
  actor: Pick<Staff, 'id' | 'role'>;
  target?: Pick<Staff, 'id' | 'role' | 'active'>;
  next: { role: Role; active: boolean };
  staff: Pick<Staff, 'id' | 'role' | 'active'>[];
}): string | null {
  const { actor, target, next, staff } = a;
  if (actor.role === 'cashier') return 'Solo el dueño puede administrar el equipo.';
  if (actor.role === 'manager') {
    if (next.role === 'owner') return 'Solo un dueño puede crear o editar dueños.';
    if (target?.role === 'owner') return 'Un gerente no puede editar a un dueño.';
  }
  if (target && target.role === 'owner' && target.active) {
    const stays = next.role === 'owner' && next.active;
    if (!stays) {
      const others = staff.filter((s) => s.id !== target.id && s.role === 'owner' && s.active);
      if (others.length === 0) return 'El negocio necesita al menos un dueño activo. Nombra primero a otro dueño y luego haz este cambio.';
    }
  }
  return null;
}

/** true si esta persona es el único dueño activo. */
export function isSoleOwner(target: Pick<Staff, 'id' | 'role' | 'active'>, staff: Pick<Staff, 'id' | 'role' | 'active'>[]): boolean {
  return target.role === 'owner' && target.active && !staff.some((s) => s.id !== target.id && s.role === 'owner' && s.active);
}

const SEQ = ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '3210', '4321', '5432', '6543', '7654', '8765', '9876'];
export function weakPin(pin: string): boolean {
  return /^(\d)\1{3}$/.test(pin) || SEQ.includes(pin);
}
