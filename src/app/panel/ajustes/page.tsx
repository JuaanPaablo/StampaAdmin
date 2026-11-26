import { cheapestWith, features, planIncludes, planPrice } from '@/lib/plans';
import { getContext } from '@/lib/context';
import { requireRole } from '@/lib/auth';
import { BUSINESS_TYPES } from '@/lib/templates';
import { PLAN_LABEL, daysToExpiry } from '@/lib/mvp-rules';
import { STAMPA_WHATSAPP_DISPLAY, customerUrl, stampaWhatsappUrl } from '@/lib/urls';
import { Badge, Card, PageHeader, btnClass } from '@/components/ui';
import { ActionForm, FormField } from '@/components/shell/action-form';
import { TIMEZONES } from '@/components/shell/labels';
import { PlaceFields } from '@/components/shell/PlaceFields';
import { provinceOfCity } from '@/lib/ecuador';
import { maxLocations, maxStaff } from '@/lib/plan-rules';
import { saveLocationAction, updateBusinessAction } from './actions';
import { DeleteLocation } from './_components/DeleteLocation';
import { CopyLink } from './_components/CopyLink';
import { LocationCoords } from './_components/LocationCoords';
import { PlanLock } from '@/components/shell/PlanLock';

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
  const [locations, people] = await Promise.all([repo.listLocations(business.id), repo.listStaff(business.id)]);
  const staffAt = (id: string) => people.filter((p) => p.active && p.locationId === id).length;
  const tzOptions = TIMEZONES.some((t) => t.value === business.timezone) ? TIMEZONES : [{ value: business.timezone, label: business.timezone }, ...TIMEZONES];
  const typeOptions = BUSINESS_TYPES.map((t) => ({ value: t.type, label: t.label }));
  const publicUrl = customerUrl(business.slug);
  const expiry = daysToExpiry(business.planExpiresAt);
  const limit = maxLocations(business.plan);
  const staffLimit = maxStaff(business.plan);
  const activeTeam = people.filter((p) => p.active && p.role !== 'owner').length;
  const proximity = features(business.plan).proximity;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ajustes" />

      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Datos del negocio</h2>
        <div className="mt-3 rounded-xl bg-surface px-4 py-3">
          <p className="text-xs font-semibold text-muted">Tu dirección pública</p>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all text-sm font-semibold text-navy underline underline-offset-4">{publicUrl}</a>
          <p className="mt-1 text-xs text-muted">La abre tu QR. No cambia si cambias el nombre.</p>
          <div className="mt-2"><CopyLink text={publicUrl} /></div>
        </div>
        <ActionForm action={updateBusinessAction} submitLabel="Guardar cambios" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="name" label="Nombre del negocio" defaultValue={business.name} maxLength={60} required />
            <div className="sm:col-span-2"><PlaceFields province={business.province ?? provinceOfCity(business.city)} city={business.city} /></div>
            <FormField name="timezone" label="Zona horaria" defaultValue={business.timezone} options={tzOptions} />
            <FormField name="type" label="Tipo de negocio" defaultValue={business.type} options={typeOptions} hint="Cambia las palabras y sugerencias del panel, no tu tarjeta." />
          </div>
        </ActionForm>
      </Card>

      <Card className="sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-navy">Sucursales</h2>
          <Badge tone={locations.length >= limit ? 'warn' : 'info'}>{locations.length} de {limit} en tu plan</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          Ubica cada sucursal en el mapa: cuando tus {template.vocab.customers} pasen cerca, el celular les recordará tu tarjeta. Incluido desde el plan {PLAN_LABEL[cheapestWith((f) => f.proximity) ?? 'standard']}.
        </p>
        {!proximity && locations.length > 0 && (
          <div className="mt-3">
            <PlanLock compact plan={cheapestWith((f) => f.proximity) ?? 'standard'} businessName={business.name} title="Avisos por cercanía"
              text="El celular de tus clientes les recuerda tu tarjeta al pasar cerca de tu local." />
          </div>
        )}

        {locations.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[#C9D6E3] px-4 py-6 text-center text-sm text-muted">Aún no tienes sucursales.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {locations.map((l) => (
              <li key={l.id} className="rounded-xl bg-surface p-4">
                <ActionForm key={l.id + l.name + (l.address ?? '')} action={saveLocationAction} submitLabel="Guardar" variant="dark" actionsClassName="mt-3">
                  <input type="hidden" name="id" value={l.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField name="name" label="Nombre" defaultValue={l.name} maxLength={60} required />
                    <FormField name="address" label="Dirección" defaultValue={l.address ?? ''} maxLength={120} autoComplete="street-address" />
                  </div>
                </ActionForm>
                {proximity && (
                  <div className="mt-3 border-t border-line pt-3">
                    <LocationCoords key={'geo-' + l.id} locationId={l.id} locationName={l.name}
                      initial={l.latitude !== undefined && l.longitude !== undefined ? { latitude: l.latitude, longitude: l.longitude } : null} />
                  </div>
                )}
                {locations.length > 1 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <DeleteLocation key={'del-' + l.id} id={l.id} name={l.name} staffCount={staffAt(l.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {locations.length >= limit ? (
          <p className="mt-5 rounded-xl bg-[#FFF4CC] px-4 py-3 text-sm text-navy">
            Llegaste al máximo de sucursales de tu plan.{' '}
            <a href={stampaWhatsappUrl(`Hola, quiero ampliar mi plan de Stampa para ${business.name} y agregar más sucursales`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Escríbenos para ampliarlo</a>.
          </p>
        ) : (
        <div className="mt-5 border-t border-line pt-5">
          <h3 className="font-display text-base font-semibold text-navy">Agregar sucursal</h3>
          <ActionForm action={saveLocationAction} submitLabel="Agregar sucursal" resetOnSuccess className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField name="name" label="Nombre" placeholder="Ej. Local centro" maxLength={60} required />
              <FormField name="address" label="Dirección (opcional)" maxLength={120} autoComplete="street-address" />
            </div>
          </ActionForm>
        </div>
        )}
      </Card>

      <span id="plan" className="-mb-6 block scroll-mt-6" aria-hidden="true" />
      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Plan</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">Tu plan</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-navy">{PLAN_LABEL[business.plan]} <span className="text-base font-semibold text-muted">· {planPrice(business.plan)} al mes</span></dd>
            <dd className="mt-0.5 text-xs text-muted">IVA incluido</dd>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">{business.autoRenew ? 'Se renueva el' : 'Vence el'}</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-navy">{business.planExpiresAt ? longDate(business.planExpiresAt, business.timezone) : 'Sin fecha de vencimiento'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted">
          Usas <strong className="text-navy">{locations.length} de {limit}</strong> {limit === 1 ? 'sucursal' : 'sucursales'} y{' '}
          <strong className="text-navy">{Number.isFinite(staffLimit) ? `${activeTeam} de ${staffLimit}` : activeTeam}</strong> {activeTeam === 1 && !Number.isFinite(staffLimit) ? 'persona' : 'personas'} en tu equipo.
        </p>
        {expiry !== null && expiry <= 7 && (
          <p role="status" className={'mt-4 rounded-xl px-4 py-3 text-sm font-medium ' + (expiry < 0 ? 'bg-[#FBE0DE] text-[#9B2A22]' : 'bg-[#FFF3CC] text-[#7A5A00]')}>
            {expiry < 0
              ? 'Tu plan ya venció. Escríbenos para renovarlo y seguir sin interrupciones.'
              : expiry === 0 ? 'Tu plan vence hoy. Escríbenos para renovarlo.'
              : `Tu plan vence en ${expiry} ${expiry === 1 ? 'día' : 'días'}. Escríbenos para renovarlo.`}
          </p>
        )}
        <ul className="mt-4 grid gap-1.5 text-sm text-navy sm:grid-cols-2">
          {planIncludes(business.plan).map((t) => <li key={t} className="flex gap-2"><span aria-hidden="true" className="text-[#12683F]">✓</span>{t}</li>)}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href={stampaWhatsappUrl(`Hola, quiero renovar/cambiar mi plan de Stampa para ${business.name}`)} target="_blank" rel="noopener noreferrer" className={btnClass('primary')}>
            Renovar o cambiar plan
          </a>
          <span className="text-sm font-semibold text-navy">{STAMPA_WHATSAPP_DISPLAY}</span>
        </div>
      </Card>

      <Card className="sm:p-6">
        <h2 className="font-display text-lg font-bold text-navy">Privacidad y datos</h2>
        <div className="mt-2 max-w-3xl space-y-3 text-sm text-navy">
          <p>Guardamos lo mínimo de cada {template.vocab.customer}: nombre, correo, cumpleaños, fecha de aceptación, sellos y canjes.</p>
          <p>Los datos son de tu negocio: úsalos solo para lo que aceptaron y atiende si alguien pide corregirlos o borrarlos.</p>
        </div>
        <div className="mt-4">
          <a href="/panel/clientes/exportar" className={btnClass('ghost')}>Descargar mis {template.vocab.customers} (CSV)</a>
        </div>
      </Card>
    </div>
  );
}
