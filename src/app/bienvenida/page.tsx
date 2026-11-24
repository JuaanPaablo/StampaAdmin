import { features } from '@/lib/plans';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/context';
import { PLACEHOLDER_BUSINESS_NAME, businessStatus } from '@/lib/mvp-rules';
import { BUSINESS_TYPES, getTemplate } from '@/lib/templates';
import { customerUrl } from '@/lib/urls';
import { money } from '@/lib/format';
import { Card, btnClass } from '@/components/ui';
import { Wordmark } from '@/components/shell/logo';
import { signOutAction } from '@/components/shell/actions';
import { ActionForm, FormField } from '@/components/shell/action-form';
import { ProgramForm } from '@/components/card/ProgramForm';
import { BusinessImages } from '@/components/card/BusinessImages';
import { CardPreview } from '@/components/card/CardPreview';
import { deleteLocationAction, saveLocationAction } from '@/app/panel/ajustes/actions';
import { PLAN_LABEL } from '@/lib/mvp-rules';
import { locationLimitText, maxLocations } from '@/lib/plan-rules';
import { provinceOfCity } from '@/lib/ecuador';
import { cleanMilestones } from '@/lib/rewards';
import { stampaWhatsappUrl } from '@/lib/urls';
import { BusinessStep } from './BusinessStep';
import { CompleteStep } from './CompleteStep';
import { finishLocationsStep, saveCardStep, saveColorsStep, skipImageStep } from './actions';
import { TOTAL_STEPS, readProgress } from './progress';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configura tu negocio · Stampa' };

const STEPS = ['Tu negocio', 'Tu imagen', 'Tus sucursales', 'Tu tarjeta', 'Listo'];

function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Wordmark />
          <form action={signOutAction}>
            <button type="submit" className="h-11 rounded-full px-4 text-[13px] font-semibold text-white/85 ring-1 ring-inset ring-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <main id="contenido" className={'mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 ' + (wide ? 'max-w-5xl' : 'max-w-3xl')}>{children}</main>
    </div>
  );
}

/**
 * "Paso N de 5" con barra y, en pantallas medianas, la lista de pasos. Los pasos ya alcanzados son enlaces: se puede
 * volver a cualquiera sin perder lo guardado (cada paso guarda al seguir).
 */
function Stepper({ step, maxStep }: { step: number; maxStep: number }) {
  return (
    <nav aria-label="Pasos de la configuración" className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Paso {step} de {TOTAL_STEPS}<span className="sm:hidden"> · {STEPS[step - 1]}</span></p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-sun transition-all motion-reduce:transition-none" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
      <ol className="mt-1 hidden gap-2 text-xs sm:flex">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const current = n === step;
          const reachable = n <= maxStep && !current;
          const done = n < maxStep;
          const text = <>{done && !current ? <span aria-hidden="true">✓ </span> : `${n}. `}{s}{done && !current && <span className="sr-only"> (hecho)</span>}</>;
          return (
            <li key={s} aria-current={current ? 'step' : undefined} className="flex-1">
              {reachable ? (
                <Link href={`/bienvenida?paso=${n}`} className="-mx-1 inline-flex min-h-11 items-center rounded px-1 text-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">{text}</Link>
              ) : (
                <span className={'inline-flex min-h-11 items-center ' + (current ? 'font-semibold text-navy' : 'text-muted')}>{text}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepTitle({ title, text }: { title: string; text?: string }) {
  return (
    <header className="mb-5">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-[28px]">{title}</h1>
      {text && <p className="mt-1 max-w-2xl text-sm text-muted">{text}</p>}
    </header>
  );
}

const backLink = (step: number) => <Link href={`/bienvenida?paso=${step - 1}`} className={btnClass('ghost')}>Atrás</Link>;

export default async function BienvenidaPage({ searchParams }: { searchParams?: { paso?: string } | Promise<{ paso?: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/ingresar');
  const status = businessStatus(ctx.business);
  if (status === 'suspended') redirect('/suspendido');
  if (status === 'active') redirect('/panel');

  const { repo, business, program, staff } = ctx;

  // Gerentes y cajeros de un negocio que el dueño todavía configura.
  if (staff.role !== 'owner') {
    return (
      <Shell>
        <Card className="mx-auto max-w-lg p-6 text-center sm:p-8">
          <h1 className="font-display text-2xl font-bold text-navy">Tu dueño está configurando el negocio</h1>
          <p className="mt-2 text-sm text-muted">Vuelve en un rato.</p>
          <Link href="/panel" className={btnClass('primary') + ' mt-6'}>Volver a intentar</Link>
        </Card>
      </Shell>
    );
  }

  const locations = await repo.listLocations(business.id);
  const limit = maxLocations(business.plan);
  const hasRealName = business.name !== PLACEHOLDER_BUSINESS_NAME;
  let progress = await readProgress(business.id);
  if (!hasRealName) progress = 0;
  else if (locations.length === 0) progress = Math.min(progress, 2);
  const maxStep = progress + 1;
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const asked = Number(sp.paso);
  const step = Number.isInteger(asked) && asked >= 1 && asked <= maxStep ? asked : maxStep;

  const template = getTemplate(business.type);
  const firstName = staff.name.split(' ')[0];

  if (step === 1) {
    return (
      <Shell>
        <Stepper step={1} maxStep={maxStep} />
        <StepTitle title={`¡Hola, ${firstName}!`}  />
        <BusinessStep
          name={hasRealName ? business.name : ''}
          type={business.type}
          city={business.city ?? ''}
          province={business.province ?? provinceOfCity(business.city) ?? ''}
          types={BUSINESS_TYPES.map((t) => ({ type: t.type, label: t.label }))}
        />
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell wide>
        <Stepper step={2} maxStep={maxStep} />
        <StepTitle title="Tu imagen" text="Opcional: puedes saltarlo." />
        <ProgramForm maxMilestones={features(business.plan).maxMilestones}
          program={program}
          businessName={business.name}
          vocab={template.vocab}
          rewardIdeas={template.rewardIdeas}
          templateColors={template.program.colors}
          action={saveColorsStep}
          wizardStep="colores"
          imagesSlot={<BusinessImages logoUrl={program.logoUrl} coverUrl={program.coverUrl} logoText={program.logoText} framing={program.imageFraming} title="Logo y foto de portada" />}
          extraActions={<>
            {backLink(2)}
            <button type="submit" formAction={skipImageStep} formNoValidate className={btnClass('ghost')}>Saltar por ahora</button>
          </>}
        />
      </Shell>
    );
  }

  if (step === 3) {
    return (
      <Shell>
        <Stepper step={3} maxStep={maxStep} />
        <StepTitle title="Tus sucursales" text={`${locations.length} de ${limit} · ${locationLimitText(business.plan, PLAN_LABEL[business.plan])}`} />
        <div className="space-y-4">
          {locations.map((l, i) => (
            <Card key={l.id}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Sucursal {i + 1}</p>
              <ActionForm key={l.id + l.name + (l.address ?? '')} action={saveLocationAction} submitLabel="Guardar" size="sm" variant="dark" actionsClassName="mt-3">
                <input type="hidden" name="id" value={l.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField name="name" label="Nombre" defaultValue={l.name} maxLength={60} required />
                  <FormField name="address" label="Dirección (opcional)" defaultValue={l.address ?? ''} maxLength={120} autoComplete="street-address" />
                </div>
              </ActionForm>
              {locations.length > 1 && (
                <ActionForm key={"del-" + l.id} action={deleteLocationAction} submitLabel={`Eliminar ${l.name}`} variant="danger" size="sm" className="mt-2" actionsClassName="mt-0">
                  <input type="hidden" name="id" value={l.id} />
                </ActionForm>
              )}
            </Card>
          ))}
          {locations.length < limit ? (
            <Card className="border-2 border-dashed border-[#C9D6E3] shadow-none ring-0">
              <h2 className="font-display text-base font-semibold text-navy">{locations.length === 0 ? 'Tu primera sucursal' : 'Agregar otra sucursal'}</h2>
              <ActionForm action={saveLocationAction} submitLabel={locations.length === 0 ? 'Agregar sucursal' : 'Agregar'} resetOnSuccess className="mt-3"
                variant={locations.length === 0 ? 'primary' : 'ghost'}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField name="name" label="Nombre" placeholder="Ej. Local principal" defaultValue={locations.length === 0 ? 'Principal' : undefined} maxLength={60} required />
                  <FormField name="address" label="Dirección (opcional)" maxLength={120} autoComplete="street-address" />
                </div>
              </ActionForm>
            </Card>
          ) : (
            <p className="rounded-xl bg-[#FFF4CC] px-4 py-3 text-sm text-navy">
              Llegaste al máximo de tu plan.{' '}
              <a href={stampaWhatsappUrl(`Hola, quiero ampliar mi plan de Stampa para ${business.name} y agregar más sucursales`)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Escríbenos para ampliarlo</a>.
            </p>
          )}
          <form action={finishLocationsStep} className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={locations.length === 0} aria-describedby={locations.length === 0 ? 'seguir-hint' : undefined} className={btnClass('primary')}>Seguir</button>
            {backLink(3)}
            {locations.length === 0 && <span id="seguir-hint" className="text-xs text-muted">Agrega una sucursal para seguir.</span>}
          </form>
        </div>
      </Shell>
    );
  }

  if (step === 4) {
    return (
      <Shell wide>
        <Stepper step={4} maxStep={maxStep} />
        <StepTitle title="Tu tarjeta" />
        <ProgramForm maxMilestones={features(business.plan).maxMilestones}
          program={program}
          businessName={business.name}
          vocab={template.vocab}
          rewardIdeas={template.rewardIdeas}
          templateColors={template.program.colors}
          action={saveCardStep}
          wizardStep="tarjeta"
          extraActions={backLink(4)}
        />
      </Shell>
    );
  }

  // Paso 5: resumen.
  // `step`: a qué paso lleva "Cambiar" (la dirección pública sale del nombre del paso 1).
  const rows: { label: string; value: string; step: number }[] = [
    { label: 'Negocio', value: business.name, step: 1 },
    { label: 'Tipo', value: template.label, step: 1 },
    { label: 'Ciudad', value: [business.city, business.province].filter(Boolean).join(', ') || 'Sin ciudad', step: 1 },
    { label: 'Sucursales', value: locations.map((l) => l.name).join(', ') || 'Ninguna', step: 3 },
    ...cleanMilestones(program.milestones, program.stampsRequired).map((m) => ({ label: `Premio del sello ${m.at}`, value: m.title, step: 4 })),
    { label: 'Premio final', value: `${program.rewardTitle} al juntar ${program.stampsRequired} sellos`, step: 4 },
    { label: 'Sello', value: program.requireAmount ? `Uno por cada ${money(program.minSpendCentsPerStamp)} de consumo` : `Uno por ${template.vocab.visit}`, step: 4 },
    { label: 'Cumpleaños', value: program.birthdayReward || 'Sin regalo', step: 4 },
    { label: 'Tu dirección pública', value: customerUrl(business.slug), step: 1 }
  ];

  return (
    <Shell wide>
      <Stepper step={5} maxStep={maxStep} />
      <StepTitle title="¡Todo listo!" text="Al abrir tu panel, tu tarjeta se activa." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="space-y-5">
          <dl className="divide-y divide-line/80">
            {rows.map((r, i) => (
              <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[170px_minmax(0,1fr)_auto]">
                <dt className="text-xs font-semibold text-muted">{r.label}</dt>
                <dd className="col-start-1 break-words text-sm font-medium text-navy sm:col-start-2 sm:row-start-1">{r.value}</dd>
                {(i === 0 || rows[i - 1].step !== r.step) && (
                  <dd className="col-start-2 row-span-2 row-start-1 sm:col-start-3 sm:row-span-1">
                    <Link href={`/bienvenida?paso=${r.step}`} className="inline-flex min-h-11 items-center rounded px-2 text-[13px] font-semibold text-navy underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">
                      Cambiar<span className="sr-only"> {r.label.toLowerCase()}</span>
                    </Link>
                  </dd>
                )}
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">Después podrás cambiar todo, menos la dirección pública (va en tu póster QR). Si quieres otra, cambia el nombre ahora.</p>
          <CompleteStep back={backLink(5)} />
        </Card>
        <CardPreview data={{
          businessName: business.name, programName: program.name, stampsRequired: program.stampsRequired, rewardTitle: program.rewardTitle,
          bg: program.colors.bg, accent: program.colors.accent, ink: program.colors.ink, logoText: program.logoText,
          logoUrl: program.logoUrl || undefined, coverUrl: program.coverUrl || undefined,
          milestones: program.milestones, logoFraming: program.imageFraming?.logo, coverFraming: program.imageFraming?.cover
        }} />
      </div>
    </Shell>
  );
}
