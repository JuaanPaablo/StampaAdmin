'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormState } from 'react-dom';
import { saveStaff } from '@/app/panel/equipo/actions';
import { Card, Input, Select, btnClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Location, Role, Staff } from '@/lib/contracts';
import type { Vocabulary } from '@/lib/templates';
import { FormField, Switch, describedBy } from '@/components/card/FormField';
import { SubmitButton } from '@/components/card/SubmitButton';
import { roleLabel, roleSummary } from './roles';
import type { StaffFormState } from './schema';

const ROLES: Role[] = ['cashier', 'manager', 'owner'];

export function StaffForm({ staff, locations, vocab, soleOwner }: {
  staff?: Staff; locations: Location[]; vocab: Vocabulary; soleOwner?: boolean;
}) {
  const isNew = !staff;
  const [state, formAction] = useFormState<StaffFormState, FormData>(saveStaff, { ok: false });
  const [role, setRole] = useState<Role>(staff?.role ?? 'cashier');
  const [active, setActive] = useState(staff?.active ?? true);
  const err = state.errors ?? {};
  const visibleLocations = locations.filter((l) => l.active || l.id === staff?.locationId);
  const first = staff?.name.split(' ')[0] ?? '';
  // Cambios delicados: se avisan antes de guardar y el botón dice exactamente lo que va a pasar.
  const deactivating = !isNew && !!staff?.active && !active;
  const toOwner = role === 'owner' && staff?.role !== 'owner';

  return (
    <form action={formAction} className="space-y-5" noValidate autoComplete="off">
      <input type="hidden" name="id" value={staff?.id ?? ''} />
      <Card as="section" className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-navy">{isNew ? 'Datos de la persona' : 'Datos y rol'}</h2>
        <FormField id="name" label="Nombre completo" error={err.name}>
          <Input id="name" name="name" defaultValue={staff?.name ?? ''} maxLength={60} required autoComplete="off"
            aria-invalid={!!err.name} aria-describedby={describedBy('name', undefined, err.name)} />
        </FormField>

        <FormField id="email" label="Correo" optional error={err.email}
          help={isNew || !staff?.email ? 'Para invitarla al panel.' : undefined}>
          <Input id="email" name="email" type="email" inputMode="email" defaultValue={staff?.email ?? ''} maxLength={254} autoComplete="off" spellCheck={false}
            placeholder="nombre@correo.com" aria-invalid={!!err.email}
            aria-describedby={describedBy('email', isNew || !staff?.email ? 'x' : undefined, err.email)} />
        </FormField>

        {/* Rol con lo que puede hacer cada uno a la vista (reconocer antes que recordar). */}
        <fieldset className="space-y-2" aria-describedby={err.role ? 'role-err' : soleOwner ? 'role-locked' : undefined}>
          <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted">Rol</legend>
          {soleOwner && <input type="hidden" name="role" value="owner" />}
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLES.map((r) => {
              const checked = role === r;
              return (
                <label key={r} className={cn(
                  'flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] bg-white p-3 transition',
                  checked ? 'border-navy bg-surface' : 'border-[#C9D6E3] hover:border-navy',
                  soleOwner && 'cursor-not-allowed opacity-60'
                )}>
                  <input type="radio" name={soleOwner ? undefined : 'role'} value={r} checked={checked} disabled={soleOwner}
                    onChange={() => setRole(r)} className="mt-0.5 size-4 shrink-0 accent-navy" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy">{roleLabel(r, vocab)}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{roleSummary(r, vocab)}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {soleOwner && <p id="role-locked" className="text-xs text-muted">Eres el único dueño activo: nombra a otro dueño antes de cambiar tu rol.</p>}
          {err.role && <p id="role-err" role="alert" className="text-xs font-medium text-bad">{err.role}</p>}
          {toOwner && !soleOwner && (
            <p className="rounded-xl bg-[#FFF3CC] px-3 py-2 text-xs font-medium text-[#7A5A00]">
              Un dueño puede cambiar el equipo, los ajustes y el plan, incluso quitarte el acceso. Elígelo solo si confías plenamente.
            </p>
          )}
        </fieldset>

        <FormField id="locationId" label="Sucursal" optional error={err.locationId}
          help={visibleLocations.length === 0 ? 'Aún no tienes sucursales. Agrégalas en Ajustes.' : undefined}>
          <Select id="locationId" name="locationId" defaultValue={staff?.locationId ?? ''}
            aria-describedby={describedBy('locationId', visibleLocations.length === 0 ? 'x' : undefined, err.locationId)}>
            <option value="">Todas las sucursales</option>
            {visibleLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </FormField>

        {isNew ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pin" label="PIN de 4 dígitos" error={err.pin} help="Aprueba acciones; no sirve para entrar. Evita fechas o números seguidos.">
              <Input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required
                aria-invalid={!!err.pin} aria-describedby={describedBy('pin', 'x', err.pin)} />
            </FormField>
            <FormField id="pinConfirm" label="Repite el PIN" error={err.pinConfirm}>
              <Input id="pinConfirm" name="pinConfirm" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required
                aria-invalid={!!err.pinConfirm} aria-describedby={describedBy('pinConfirm', undefined, err.pinConfirm)} />
            </FormField>
          </div>
        ) : (
          <p className="text-xs text-muted">
            {staff?.hasPin ? 'Tiene PIN.' : 'Sin PIN.'} <a href="#restablecer-pin" className="font-semibold text-navy underline underline-offset-4">Cambiar PIN</a>
          </p>
        )}

        {isNew ? <input type="hidden" name="active" value="1" /> : (
          <div className="space-y-2">
            <Switch id="active" name="active" checked={active} onChange={setActive} label="Activo" disabled={soleOwner}
              help={soleOwner
                ? 'Eres el único dueño activo: nombra a otro dueño antes de desactivarte.'
                : 'Desactivada no entra ni da sellos. Su historial se conserva.'} />
            {deactivating && (
              <p className="rounded-xl bg-[#FBE0DE] px-3 py-2 text-xs font-medium text-[#9B2A22]">
                Al guardar, {first} ya no podrá entrar al panel ni dar sellos. Puedes reactivarla cuando quieras.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <div aria-live="polite" role="status" className="min-h-[1.25rem]">
          {state.message && <p className={'text-sm font-medium ' + (state.ok ? 'text-[#12683F]' : 'text-bad')}>{state.message}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant={deactivating ? 'danger' : 'primary'} pendingText={isNew ? 'Agregando…' : 'Guardando…'}>
            {isNew ? 'Agregar persona' : deactivating ? `Desactivar a ${first}` : 'Guardar cambios'}
          </SubmitButton>
          <Link href="/panel/equipo" className={btnClass('ghost')}>{isNew ? 'Cancelar' : 'Volver al equipo'}</Link>
        </div>
      </div>
    </form>
  );
}
