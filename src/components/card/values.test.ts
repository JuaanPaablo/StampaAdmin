import { describe, expect, it } from 'vitest';
import type { FormValues } from './values';
import { firstErrorField, validateValues } from './values';
import { checkImageFile, mbText } from './images';

const base: FormValues = {
  name: 'Tarjeta Café', stampsRequired: 10, rewardTitle: 'Café gratis', rewardDescription: '',
  bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF', logoText: 'TC',
  birthdayReward: '', rewardExpiresDays: '', terms: '',
  requireAmount: false, minSpend: '5,00',
  codeTtlSeconds: 300, maxSeatsWithoutApproval: 4, cooldownMinutes: 60,
  milestones: []
};
const all = { identidad: true, premio: true, premioExtra: true, colores: true, monto: true };

describe('validateValues', () => {
  it('acepta una tarjeta válida', () => {
    expect(validateValues(base, all)).toEqual({});
  });

  it('marca premio intermedio en o después del último sello', () => {
    const e = validateValues({ ...base, stampsRequired: 6, milestones: [{ at: 8, title: 'Postre' }] }, all);
    expect(e.milestones).toMatch(/antes del sello 6/);
  });

  it('marca premio intermedio sin nombre y respeta el límite del plan', () => {
    expect(validateValues({ ...base, milestones: [{ at: 5, title: '' }] }, all).milestones).toMatch(/sello 5/);
    const two = [{ at: 3, title: 'Galleta' }, { at: 6, title: 'Postre' }];
    expect(validateValues({ ...base, milestones: two }, all, 1).milestones).toMatch(/1 premio/);
  });

  it('acepta colores cortos (se normalizan) y rechaza los inválidos', () => {
    expect(validateValues({ ...base, bg: 'fff' }, all).bg).toBeUndefined();
    expect(validateValues({ ...base, bg: '#12' }, all).bg).toMatch(/#RRGGBB/);
  });

  it('valida el monto mínimo solo si el sello depende del monto', () => {
    expect(validateValues({ ...base, minSpend: '0,10' }, all).minSpend).toBeUndefined();
    expect(validateValues({ ...base, requireAmount: true, minSpend: '0,10' }, all).minSpend).toMatch(/\$0,50/);
  });

  it('solo revisa las secciones visibles (asistente)', () => {
    const v = { ...base, name: '', rewardTitle: '' };
    expect(validateValues(v, { colores: true })).toEqual({});
    expect(Object.keys(validateValues(v, { premio: true }))).toEqual(['rewardTitle']);
  });

  it('el primer error sigue el orden de la pantalla', () => {
    expect(firstErrorField({ ink: 'x', name: 'y' })).toBe('name');
  });
});

describe('checkImageFile', () => {
  it('dice el peso real y qué hacer', () => {
    const msg = checkImageFile({ type: 'image/png', size: 3.4 * 1024 * 1024 });
    expect(msg).toMatch(/3,4 MB/);
    expect(msg).toMatch(/2 MB/);
    expect(checkImageFile({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPG o WEBP/);
    expect(mbText(2.01 * 1024 * 1024)).toBe('2,1 MB');
  });
});
