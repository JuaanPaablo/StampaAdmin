import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { BUSINESS_TYPES } from '@/lib/templates';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { ActionForm, FormField } from '@/components/shell/action-form';
import { PLAN_LABEL, TIMEZONES } from '@/components/shell/labels';
import type { Plan } from '@/lib/contracts';
import { saveLocationAction, updateBusinessAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ajustes · Stampa' };

const PLANS: { id: Plan; name: string; forWho: string; points: string[] }[] = [
  { id: 'gratis', name: 'Gratis', forWho: 'Para empezar con tu tarjeta de sellos.', points: ['Tarjeta de sellos y códigos de un solo uso', 'Clientes y premios', 'Un equipo básico'] },
  { id: 'negocio', name: 'Negocio', forWho: 'Para negocios que ya operan con un equipo.', points: ['Todo lo de Gratis', 'Más sucursales y personas en el equipo', 'Reportes y control antifraude ampliados'] },
  { id: 'pro', name: 'Pro', forWho: 'Para varias sucursales y necesidades avanzadas.', points: ['Todo lo de Negocio', 'Pensado para operaciones más grandes', 'Funciones avanzadas a medida'] }
];

export default async function AjustesPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template } = ctx;
  const locations = await repo.listLocations(business.id);
  const tzOptions = TIMEZONES.some((t) => t.value === business.timezone) ? TIMEZONES : [{ value: business.timezone, label: business.timezone }, ...TIMEZONES];
  const typeOptions = BUSINESS_TYPES.map((t) => ({ value: t.type, label: t.label }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ajustes" subtitle={`Datos de ${business.name}, sucursales, plan y privacidad.`} />

      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Datos del negocio</h2>
        <ActionForm action={updateBusinessAction} submitLabel="Guardar cambios" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="name" label="Nombre del negocio" defaultValue={business.name} maxLength={60} required />
            <FormField name="city" label="Ciudad" defaultValue={business.city ?? ''} maxLength={60} autoComplete="address-level2" />
            <FormField name="timezone" label="Zona horaria" defaultValue={business.timezone} options={tzOptions} hint="Define la hora de los sellos, reportes y horarios." />
            <FormField name="type" label="Tipo de negocio" defaultValue={business.type} options={typeOptions} hint="Cambiar el tipo actualiza las palabras del panel y las sugerencias. No modifica la tarjeta que ya creaste: su premio y sus reglas se quedan como están." />
          </div>
        </ActionForm>
      </Card>

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-navy">Sucursales</h2>
          <Badge tone="info">{locations.filter((l) => l.active).length} activas</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">Cada código de sello puede quedar asociado a una sucursal. Desactiva las que ya no uses: su historial se conserva.</p>

        {locations.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[#C9D6E3] px-4 py-6 text-center text-sm text-muted">Aún no tienes sucursales. Agrega la primera aquí abajo.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {locations.map((l) => (
              <li key={l.id} className="rounded-xl bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Sucursal</span>
                  <Badge tone={l.active ? 'ok' : 'neutral'}>{l.active ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                <ActionForm action={saveLocationAction} submitLabel="Guardar" size="sm" variant="dark" actionsClassName="mt-3">
                  <input type="hidden" name="id" value={l.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField name="name" label="Nombre" defaultValue={l.name} maxLength={60} required />
                    <FormField name="address" label="Dirección" defaultValue={l.address ?? ''} maxLength={120} autoComplete="street-address" />
                  </div>
                </ActionForm>
                <ActionForm action={saveLocationAction} submitLabel={l.active ? 'Desactivar' : 'Activar'} variant={l.active ? 'danger' : 'ghost'} size="sm" className="mt-2" actionsClassName="mt-0">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="name" value={l.name} />
                  <input type="hidden" name="address" value={l.address ?? ''} />
                  <input type="hidden" name="active" value={l.active ? 'false' : 'true'} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t border-line pt-5">
          <h3 className="font-display text-base font-semibold text-navy">Agregar sucursal</h3>
          <ActionForm action={saveLocationAction} submitLabel="Agregar sucursal" resetOnSuccess className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField name="name" label="Nombre" placeholder="Ej. Local centro" maxLength={60} required />
              <FormField name="address" label="Dirección (opcional)" maxLength={120} autoComplete="street-address" />
            </div>
          </ActionForm>
        </div>
      </Card>

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-bold text-navy">Plan</h2>
          <Badge tone="sun">Tu plan: {PLAN_LABEL[business.plan]}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">Así se piensan los planes de Stampa. Los precios y los límites exactos de cada uno se publicarán antes de habilitar el cambio.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PLANS.map((p) => {
            const current = p.id === business.plan;
            return (
              <div key={p.id} className={'flex flex-col rounded-xl p-4 ring-1 ring-inset ' + (current ? 'bg-white ring-2 ring-navy' : 'bg-surface ring-line')}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-navy">{p.name}</h3>
                  {current && <Badge tone="info">Actual</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">{p.forWho}</p>
                <ul className="mt-3 flex flex-col gap-1.5 text-sm text-navy">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" />{pt}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Button type="button" variant="ghost" disabled aria-disabled="true">Cambiar plan (próximamente)</Button>
        </div>
      </Card>

      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Privacidad y datos</h2>
        <div className="mt-2 max-w-3xl space-y-3 text-sm text-navy">
          <p>De cada {template.vocab.customer} Stampa guarda lo mínimo para que la tarjeta funcione: su nombre, un contacto (WhatsApp o correo), su cumpleaños si decide darlo y la fecha en que aceptó participar. Además guarda los sellos y los premios canjeados.</p>
          <p>Estos datos pertenecen a tu negocio. Tú eres responsable de usarlos solo para lo que tus {template.vocab.customers} aceptaron, por ejemplo avisarles de sus sellos y premios, y de atender cuando alguien pida corregir o borrar su información.</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" disabled aria-disabled="true">Exportar datos de {template.vocab.customers} (pendiente)</Button>
          <span className="text-xs text-muted">La exportación estará disponible pronto.</span>
        </div>
      </Card>
    </div>
  );
}
