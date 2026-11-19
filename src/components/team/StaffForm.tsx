'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormState } from 'react-dom';
import { saveStaff } from '@/app/panel/equipo/actions';
import { Card, Input, Select, btnClass } from '@/components/ui';
import type { Location, Role, Staff } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';
import { FormField, Switch, describedBy } from '@/components/card/FormField';
import { SubmitButton } from '@/components/card/SubmitButton';
import { roleLabel } from './roles';
import type { StaffFormState } from './schema';

export function StaffForm({ staff, locations, vocab, soleOwner }: {
  staff?: Staff; locations: Location[]; vocab: Vocabulary; soleOwner?: boolean;
}) {
  const isNew = !staff;
  const [state, formAction] = useFormState<StaffFormState, FormData>(saveStaff, { ok: false });
  const [role, setRole] = useState<Role>(staff?.role ?? 'cashier');
  const [active, setActive] = useState(staff?.active ?? true);
  const err = state.errors ?? {};
  const roles: Role[] = ['cashier', 'manager', 'owner'];
  const visibleLocations = locations.filter((l) => l.active || l.id === staff?.locationId);

  return (
    <form action={formAction} className="space-y-5" noValidate autoComplete="off">
      <input type="hidden" name="id" value={staff?.id ?? ''} />
      <Card as="section" className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-navy">{isNew ? 'Datos de la persona' : 'Datos y acceso'}</h2>
        <FormField id="name" label="Nombre completo" error={err.name}>
          <Input id="name" name="name" defaultValue={staff?.name ?? ''} maxLength={60} required autoComplete="off"
            aria-invalid={!!err.name} aria-describedby={describedBy('name', undefined, err.name)} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="role" label="Rol" error={err.role}
            help={role === 'owner' ? 'Acceso total, incluido el equipo y los ajustes.' : role === 'manager' ? 'Ve el resumen, edita la tarjeta y aprueba cupos con su PIN.' : `Atiende en ${vocab.counter.toLowerCase()}, da sellos y canjea premios.`}>
            {soleOwner && <input type="hidden" name="role" value="owner" />}
            <Select id="role" name={soleOwner ? undefined : 'role'} value={role} disabled={soleOwner} onChange={(e) => setRole(e.target.value as Role)}
              aria-describedby={describedBy('role', 'x', err.role)}>
              {roles.map((r) => <option key={r} value={r}>{roleLabel(r, vocab)}</option>)}
            </Select>
          </FormField>
          <FormField id="locationId" label="Sucursal" optional error={err.locationId}
            help={visibleLocations.length === 0 ? 'Aún no hay sucursales: la persona trabaja en todo el negocio.' : 'Déjalo en "Todas" si trabaja en más de una.'}>
            <Select id="locationId" name="locationId" defaultValue={staff?.locationId ?? ''} aria-describedby={describedBy('locationId', 'x', err.locationId)}>
              <option value="">Todas las sucursales</option>
              {visibleLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </FormField>
        </div>

        {isNew ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pin" label="PIN de 4 dígitos" error={err.pin} help="Lo usará para aprobar acciones dentro del panel (no sirve para entrar). Evita fechas o números seguidos.">
              <Input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required
                aria-invalid={!!err.pin} aria-describedby={describedBy('pin', 'x', err.pin)} />
            </FormField>
            <FormField id="pinConfirm" label="Repite el PIN" error={err.pinConfirm}>
              <Input id="pinConfirm" name="pinConfirm" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required
                aria-invalid={!!err.pinConfirm} aria-describedby={describedBy('pinConfirm', undefined, err.pinConfirm)} />
            </FormField>
          </div>
        ) : (
          <p className="text-xs text-muted">{staff?.hasPin ? 'Esta persona ya tiene PIN.' : 'Esta persona aún no tiene PIN.'} Para cambiarlo usa "Restablecer PIN" más abajo.</p>
        )}

        {isNew ? <input type="hidden" name="active" value="1" /> : (
          <Switch id="active" name="active" checked={active} onChange={setActive} label="Activo" disabled={soleOwner}
            help={soleOwner
              ? 'Eres el único dueño activo, por eso no puedes cambiar tu rol ni desactivarte. Nombra primero a otro dueño.'
              : 'Una persona desactivada no puede entrar ni dar sellos. Su historial se conserva y puedes reactivarla cuando quieras.'} />
        )}
      </Card>

      <div className="space-y-3">
        <div aria-live="polite" role="status" className="min-h-[1.25rem]">
          {state.message && <p className={'text-sm font-medium ' + (state.ok ? 'text-[#12683F]' : 'text-bad')}>{state.message}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>{isNew ? 'Agregar persona' : 'Guardar cambios'}</SubmitButton>
          <Link href="/panel/equipo" className={btnClass('ghost')}>Volver al equipo</Link>
        </div>
      </div>
    </form>
  );
}
