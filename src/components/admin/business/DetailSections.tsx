import { Badge, Meter, Table, Td, Th } from '@/components/ui';
import type { AdminAction, AdminBusinessDetail, AdminPayment, AdminStaffRow, Alert, Location, Plan, Severity } from '@/lib/contracts';
import { PAYMENT_METHOD_LABEL, ecDateLabel, ecEndOfDayIso, formatCents, isDayKey } from '@/lib/domain/admin-insights';
import { features } from '@/lib/plans';
import { num } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ROLE_LABEL, formatDateTime, relativeTime, staffAccessLabel } from '../helpers';

/** Partes de la ficha del negocio que solo muestran datos (componentes de servidor). */

const dayLabel = (day: string) => (isDayKey(day) ? ecDateLabel(ecEndOfDayIso(day)) : day);
const monthsText = (m: number | null) => (m === null ? 'Fecha elegida' : `${m} ${m === 1 ? 'mes' : 'meses'}`);

/* ---------- Pagos ---------- */

export function PaymentHistory({ payments }: { payments: AdminPayment[] }) {
  if (payments.length === 0) return <p className="text-sm text-muted">Aún no hay pagos registrados.</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-line sm:hidden" aria-label="Pagos registrados">
        {payments.map((p) => (
          <li key={p.id} className="flex flex-col gap-0.5 py-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-navy tabular-nums">{formatCents(p.amountCents)}</span>
              <span className="text-muted">{dayLabel(p.paidAt)}</span>
            </div>
            <span className="text-navy">{PAYMENT_METHOD_LABEL[p.method]} · {monthsText(p.months)} · vence el {ecDateLabel(p.newExpiresAt)}</span>
            {p.note && <span className="break-words text-xs text-muted">{p.note}</span>}
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <Table label="Pagos registrados" className="shadow-none ring-line [&_table]:min-w-[600px]">
          <thead>
            <tr><Th>Fecha</Th><Th className="text-right">Monto</Th><Th>Forma</Th><Th>Periodo</Th><Th>Nuevo vencimiento</Th><Th>Nota</Th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap">{dayLabel(p.paidAt)}</Td>
                <Td className="whitespace-nowrap text-right font-semibold">{formatCents(p.amountCents)}</Td>
                <Td>{PAYMENT_METHOD_LABEL[p.method]}</Td>
                <Td className="whitespace-nowrap">{monthsText(p.months)}</Td>
                <Td className="whitespace-nowrap">{ecDateLabel(p.newExpiresAt)}</Td>
                <Td className="max-w-[220px] break-words text-xs text-muted">{p.note ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

/* ---------- Historial de acciones ---------- */

export function ActionTimeline({ actions, now }: { actions: AdminAction[]; now: number }) {
  if (actions.length === 0) return <p className="text-sm text-muted">Todavía no hay acciones registradas.</p>;
  return (
    <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-5">
      {actions.map((a) => (
        <li key={a.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-navy ring-1 ring-line" />
          <p className="text-sm text-navy">{a.summary}</p>
          <p className="mt-0.5 text-xs text-muted">
            {a.adminEmail ?? 'Administrador'} · <time dateTime={a.createdAt}>{relativeTime(a.createdAt, now)}</time> · {formatDateTime(a.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Equipo y sucursales ---------- */

export function StaffList({ staff }: { staff: AdminStaffRow[] }) {
  if (staff.length === 0) return <p className="text-sm text-muted">No hay personas en el equipo.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {staff.map((s) => (
        <li key={s.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('font-semibold', s.active ? 'text-navy' : 'text-muted')}>{s.name}</span>
            <Badge tone={s.role === 'owner' ? 'sun' : 'info'}>{ROLE_LABEL[s.role]}</Badge>
            {!s.active && <Badge tone="neutral">Inactivo</Badge>}
          </div>
          <span className="break-all text-xs text-muted">
            {s.email ? `${s.email} · ` : ''}{staffAccessLabel(s)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LocationList({ locations }: { locations: Location[] }) {
  if (locations.length === 0) return <p className="text-sm text-muted">Sin sucursales todavía.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {locations.map((l) => (
        <li key={l.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('font-semibold', l.active ? 'text-navy' : 'text-muted')}>{l.name}</span>
            {!l.active && <Badge tone="neutral">Desactivada</Badge>}
          </div>
          {l.address && <span className="text-xs text-muted">{l.address}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Alertas ---------- */

const SEVERITY: Record<Severity, { label: string; tone: 'bad' | 'warn' | 'info' }> = {
  critical: { label: 'Crítica', tone: 'bad' }, warning: { label: 'Aviso', tone: 'warn' }, info: { label: 'Información', tone: 'info' }
};

export function AlertsSummary({ alerts, now }: { alerts: AdminBusinessDetail['alerts']; now: number }) {
  const counts = [
    { label: 'En 60 días', value: alerts.total, cls: 'text-navy' },
    { label: 'Críticas', value: alerts.critical, cls: alerts.critical > 0 ? 'text-[#9B2A22]' : 'text-navy' },
    { label: 'Avisos', value: alerts.warning, cls: alerts.warning > 0 ? 'text-[#7A5A00]' : 'text-navy' }
  ];
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-2">
        {counts.map((c) => (
          <div key={c.label} className="rounded-xl bg-surface px-3 py-2.5">
            <dt className="text-xs text-muted">{c.label}</dt>
            <dd className={cn('font-display text-2xl font-bold tabular-nums', c.cls)}>{num(c.value)}</dd>
          </div>
        ))}
      </dl>
      {alerts.recent.length === 0 ? (
        <p className="text-sm text-muted">Sin alertas recientes.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line" aria-label="Alertas recientes">
          {alerts.recent.map((a: Alert) => (
            <li key={a.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SEVERITY[a.severity].tone}>{SEVERITY[a.severity].label}</Badge>
                <time dateTime={a.at} className="text-xs text-muted" title={formatDateTime(a.at)}>{relativeTime(a.at, now)}</time>
              </div>
              <p className="text-sm text-navy">{a.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- IA del mes ---------- */

/** Dólares con coma decimal: "$0,42". Montos menores a un centavo se muestran como tal. */
export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return 'menos de $0,01';
  return '$' + n.toFixed(2).replace('.', ',');
}

/** Umbrales del aviso de costo de IA respecto al precio del plan. */
export const AI_RATIO_WARN = 0.1;
export const AI_RATIO_BAD = 0.25;

export function AiUsage({ ai, plan }: { ai: AdminBusinessDetail['ai']; plan: Plan }) {
  const f = features(plan);
  const pctText = `${num(ai.ratio * 100, ai.ratio > 0 && ai.ratio < 0.1 ? 1 : 0)} %`;
  const level = ai.ratio >= AI_RATIO_BAD ? 'bad' : ai.ratio >= AI_RATIO_WARN ? 'warn' : 'ok';
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Textos</span>
          <span className="text-sm font-semibold text-navy tabular-nums">{num(ai.texts)} de {num(f.aiTexts)}</span>
          <Meter value={f.aiTexts ? ai.texts / f.aiTexts : 0} tone={ai.texts >= f.aiTexts ? 'bad' : 'navy'} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Fotos</span>
          <span className="text-sm font-semibold text-navy tabular-nums">{num(ai.images)} de {num(f.aiImages)}</span>
          <Meter value={f.aiImages ? ai.images / f.aiImages : 0} tone={ai.images >= f.aiImages ? 'bad' : 'navy'} />
        </div>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Costo estimado</dt><dd className="text-right font-semibold text-navy tabular-nums">{formatUsd(ai.costUsd)}</dd>
        <dt className="text-muted">Precio del plan</dt><dd className="text-right text-navy tabular-nums">{formatUsd(ai.planPriceUsd)}</dd>
        <dt className="text-muted">Parte del plan</dt><dd className="text-right font-semibold text-navy tabular-nums">{pctText}</dd>
      </dl>
      {level !== 'ok' && (
        <p className={cn('rounded-xl px-3 py-2.5 text-sm', level === 'bad' ? 'bg-[#FBE0DE] text-[#9B2A22]' : 'bg-[#FFF3CC] text-[#7A5A00]')}>
          <strong className="font-semibold">{level === 'bad' ? 'Costo alto.' : 'Atento.'}</strong>{' '}
          La IA ya cuesta el {pctText} de lo que paga este negocio.
        </p>
      )}
      {(ai.promptTokens > 0 || ai.completionTokens > 0) && (
        <p className="text-xs text-muted">
          {num(ai.promptTokens)} tokens de entrada ({num(ai.cachedTokens)} en caché) y {num(ai.completionTokens)} de salida.
        </p>
      )}
    </div>
  );
}
