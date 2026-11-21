import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { BUSINESS_TYPES } from '@/lib/templates';
import { PLAN_LABEL, daysToExpiry } from '@/lib/mvp-rules';
import { STAMPA_WHATSAPP_DISPLAY, customerUrl, stampaWhatsappUrl } from '@/lib/urls';
import { Badge, Card, PageHeader, btnClass } from '@/components/ui';
import { ActionForm, FormField } from '@/components/shell/action-form';
import { TIMEZONES } from '@/components/shell/labels';
import { saveLocationAction, updateBusinessAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ajustes · Stampa' };

function longDate(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone });
  } catch {
    return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

export default async function AjustesPage() {
  const ctx = await getContext();
  requireRole(ctx, ['owner']);
  const { repo, business, template } = ctx;
  const locations = await repo.listLocations(business.id);
  const tzOptions = TIMEZONES.some((t) => t.value === business.timezone) ? TIMEZONES : [{ value: business.timezone, label: business.timezone }, ...TIMEZONES];
  const typeOptions = BUSINESS_TYPES.map((t) => ({ value: t.type, label: t.label }));
  const publicUrl = customerUrl(business.slug);
  const expiry = daysToExpiry(business.planExpiresAt);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ajustes" subtitle={`Datos de ${business.name}, sucursales, plan y privacidad.`} />

      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Datos del negocio</h2>
        <div className="mt-3 rounded-xl bg-surface px-4 py-3">
          <p className="text-xs font-semibold text-muted">Tu dirección pública</p>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-sm font-semibold text-navy underline underline-offset-4">{publicUrl}</a>
          <p className="mt-1 text-xs text-muted">Es la que abre el QR de tu póster. No cambia aunque cambies el nombre.</p>
        </div>
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
        <h2 className="font-display text-lg font-bold text-navy">Plan</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">Tu plan</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-navy">{PLAN_LABEL[business.plan]}</dd>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">Vence el</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-navy">{business.planExpiresAt ? longDate(business.planExpiresAt, business.timezone) : 'Sin fecha de vencimiento'}</dd>
          </div>
        </dl>
        {expiry !== null && expiry <= 7 && (
          <p role="status" className={'mt-4 rounded-xl px-4 py-3 text-sm font-medium ' + (expiry < 0 ? 'bg-[#FBE0DE] text-[#9B2A22]' : 'bg-[#FFF3CC] text-[#7A5A00]')}>
            {expiry < 0
              ? 'Tu plan ya venció. Escríbenos para renovarlo y seguir sin interrupciones.'
              : expiry === 0 ? 'Tu plan vence hoy. Escríbenos para renovarlo.'
              : `Tu plan vence en ${expiry} ${expiry === 1 ? 'día' : 'días'}. Escríbenos para renovarlo.`}
          </p>
        )}
        <p className="mt-4 text-sm text-muted">¿Quieres renovar o cambiar de plan? Escríbenos y te ayudamos.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={stampaWhatsappUrl(`Hola, quiero renovar/cambiar mi plan de Stampa para ${business.name}`)} target="_blank" rel="noopener noreferrer" className={btnClass('primary')}>
            Escríbenos por WhatsApp
          </a>
          <span className="text-sm font-semibold text-navy">{STAMPA_WHATSAPP_DISPLAY}</span>
        </div>
      </Card>

      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Privacidad y datos</h2>
        <div className="mt-2 max-w-3xl space-y-3 text-sm text-navy">
          <p>De cada {template.vocab.customer} Stampa guarda lo mínimo para que la tarjeta funcione: su nombre, su correo, su fecha de nacimiento y la fecha en que aceptó participar. También guarda sus sellos y los premios que canjeó.</p>
          <p>Estos datos son de tu negocio. Úsalos solo para lo que tus {template.vocab.customers} aceptaron, como avisarles de sus sellos y premios. Si alguien pide corregir o borrar sus datos, atiéndelo.</p>
        </div>
        <div className="mt-4">
          <a href="/panel/clientes/exportar" className={btnClass('ghost')}>Descargar mis {template.vocab.customers} (CSV)</a>
        </div>
      </Card>
    </div>
  );
}
