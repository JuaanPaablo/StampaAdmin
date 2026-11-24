'use client';

import { useMemo } from 'react';
import { birthYears, daysInMonth, MONTH_NAMES } from './card-model';
import { fieldInput } from './Shell';

export interface BirthValue { day: string; month: string; year: string }

/** Fecha de nacimiento con tres selects (día, mes, año): nada de formatos raros que teclear. */
export function BirthdateFields({ value, onChange, error, idPrefix = 'nac' }: { value: BirthValue; onChange: (v: BirthValue) => void; error?: string; idPrefix?: string }) {
  const years = useMemo(() => birthYears(), []);
  const errId = `${idPrefix}-err`;
  // Días que no existen en el mes elegido (31 de abril, 30 de febrero) quedan deshabilitados.
  const maxDay = value.month === '' ? 31 : daysInMonth(Number(value.month), value.year === '' ? undefined : Number(value.year));
  const common = { 'aria-invalid': !!error, 'aria-describedby': error ? errId : undefined, required: true } as const;
  const cls = fieldInput + ' appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-8';
  const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23001D3D' stroke-width='2'/%3E%3C/svg%3E\")" };
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-navy">Fecha de nacimiento</legend>
      <div className="grid grid-cols-[1fr_1.6fr_1.3fr] gap-2">
        <label className="sr-only" htmlFor={`${idPrefix}-d`}>Día</label>
        <select id={`${idPrefix}-d`} name="day" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} className={cls} style={chevron} {...common}>
          <option value="">Día</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1} disabled={i + 1 > maxDay}>{i + 1}</option>)}
        </select>
        <label className="sr-only" htmlFor={`${idPrefix}-m`}>Mes</label>
        <select id={`${idPrefix}-m`} name="month" value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })} className={cls} style={chevron} {...common}>
          <option value="">Mes</option>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
        </select>
        <label className="sr-only" htmlFor={`${idPrefix}-y`}>Año</label>
        <select id={`${idPrefix}-y`} name="year" value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })} className={cls} style={chevron} {...common}>
          <option value="">Año</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <p className="mt-1.5 text-xs text-muted">Para saludarte en tu cumpleaños.</p>
      {error && <p id={errId} className="mt-1 text-sm font-medium text-bad">{error}</p>}
    </fieldset>
  );
}
