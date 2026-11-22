import type { Role } from './contracts';
import type { Vocabulary } from './templates';

export interface NavItem { href: string; label: (v: Vocabulary) => string; icon: 'home' | 'counter' | 'users' | 'shield' | 'card' | 'megaphone' | 'team' | 'settings'; roles: Role[] }

/** Menú lateral. El agente B lo dibuja; cada módulo vive bajo su ruta. */
export const NAV: NavItem[] = [
  { href: '/panel', label: () => 'Resumen', icon: 'home', roles: ['owner', 'manager'] },
  { href: '/panel/caja', label: (v) => v.counter, icon: 'counter', roles: ['owner', 'manager', 'cashier'] },
  { href: '/panel/clientes', label: (v) => v.customers.charAt(0).toUpperCase() + v.customers.slice(1), icon: 'users', roles: ['owner', 'manager'] },
  { href: '/panel/control', label: () => 'Control', icon: 'shield', roles: ['owner', 'manager'] },
  { href: '/panel/tarjeta', label: () => 'Tarjeta', icon: 'card', roles: ['owner', 'manager'] },
  { href: '/panel/marketing', label: () => 'Marketing', icon: 'megaphone', roles: ['owner', 'manager'] },
  { href: '/panel/equipo', label: () => 'Equipo', icon: 'team', roles: ['owner'] },
  { href: '/panel/ajustes', label: () => 'Ajustes', icon: 'settings', roles: ['owner'] }
];
