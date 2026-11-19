import { NAV } from '@/lib/nav';
import type { Role } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';
import { Card } from '@/components/ui';
import { roleDescription, roleLabel } from './roles';

const ROLES: Role[] = ['owner', 'manager', 'cashier'];

function navAllows(href: string, role: Role): boolean {
  return NAV.find((n) => n.href === href)?.roles.includes(role) ?? false;
}

function Cell({ yes }: { yes: boolean }) {
  return (
    <td className="border-b border-line/70 px-4 py-3 text-center align-middle">
      <span className={'inline-flex items-center gap-1.5 text-sm font-semibold ' + (yes ? 'text-[#12683F]' : 'text-muted')}>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {yes ? <path d="M4 10.5l4 4 8-9" /> : <path d="M5 10h10" />}
        </svg>
        {yes ? 'Sí' : 'No'}
      </span>
    </td>
  );
}

/** Matriz de permisos por rol. Los accesos a pantallas se leen de NAV para que no se desincronicen. */
export function RoleMatrix({ vocab }: { vocab: Vocabulary }) {
  const rows: { label: string; allow: (r: Role) => boolean }[] = [
    { label: 'Ver el resumen del negocio', allow: (r) => navAllows('/panel', r) },
    { label: `Dar sellos y canjear premios en ${vocab.counter.toLowerCase()}`, allow: (r) => navAllows('/panel/caja', r) },
    { label: `Ver y buscar a tus ${vocab.customers}`, allow: (r) => navAllows('/panel/clientes', r) },
    { label: 'Aprobar más cupos de los permitidos con su PIN', allow: (r) => r === 'owner' || r === 'manager' },
    { label: 'Revisar el control antifraude y las alertas', allow: (r) => navAllows('/panel/control', r) },
    { label: 'Editar la tarjeta, el premio y las reglas de sellos', allow: (r) => navAllows('/panel/tarjeta', r) },
    { label: 'Agregar personas, cambiar roles y restablecer PIN', allow: (r) => navAllows('/panel/equipo', r) },
    { label: 'Cambiar los ajustes del negocio', allow: (r) => navAllows('/panel/ajustes', r) }
  ];
  return (
    <Card as="section" className="space-y-4 overflow-hidden">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy">Qué puede hacer cada rol</h2>
        <p className="mt-1 text-sm text-muted">Elige el rol con el menor acceso que la persona necesite. Solo un dueño puede crear o editar dueños.</p>
      </div>
      <div className="relative -mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <caption className="sr-only">Permisos por rol: dueño, gerente y {vocab.staffRole}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Acción</th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="border-b border-line px-4 py-3 text-center align-top">
                  <span className="block text-sm font-semibold text-navy">{roleLabel(r, vocab)}</span>
                  <span className="block text-[11px] font-normal text-muted">{roleDescription(r, vocab)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="border-b border-line/70 px-4 py-3 text-left text-sm font-medium text-navy">{row.label}</th>
                {ROLES.map((r) => <Cell key={r} yes={row.allow(r)} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
