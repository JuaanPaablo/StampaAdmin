'use client';

import { useState } from 'react';
import { PROVINCES, citiesOf } from '@/lib/ecuador';

const label = 'text-xs font-semibold tracking-wide text-muted';
const select =
  'h-12 w-full rounded-xl border-[1.5px] border-[#C9D6E3] bg-white px-3.5 pr-8 text-[15px] text-navy focus:border-navy focus:outline-none focus:ring-4 focus:ring-sun/50 aria-[invalid=true]:border-bad disabled:bg-surface disabled:text-muted';

/** Provincia y ciudad (cantón) de Ecuador: la ciudad depende de la provincia. Ambas obligatorias. */
export function PlaceFields({ province, city, errors = {} }: { province?: string; city?: string; errors?: { province?: string; city?: string } }) {
  const [p, setP] = useState(province && citiesOf(province).length ? province : '');
  const [c, setC] = useState(p && city && citiesOf(p).includes(city) ? city : '');
  const cities = p ? citiesOf(p) : [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="province" className={label}>Provincia</label>
        <select id="province" name="province" required value={p} className={select} aria-invalid={!!errors.province && !p}
          aria-describedby={errors.province ? 'province-err' : undefined}
          onChange={(e) => { setP(e.target.value); setC(citiesOf(e.target.value)[0] ?? ''); }}>
          <option value="" disabled>Elige la provincia</option>
          {PROVINCES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        {errors.province && !p && <p id="province-err" role="alert" className="text-xs font-medium text-bad">{errors.province}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className={label}>Ciudad</label>
        <select id="city" name="city" required value={c} disabled={!p} className={select} aria-invalid={!!errors.city && !c}
          aria-describedby={errors.city ? 'city-err' : undefined} onChange={(e) => setC(e.target.value)}>
          {!p && <option value="">Primero la provincia</option>}
          {cities.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        {errors.city && !c && <p id="city-err" role="alert" className="text-xs font-medium text-bad">{errors.city}</p>}
      </div>
    </div>
  );
}
