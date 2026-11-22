import { describe, expect, it } from 'vitest';
import type { AdminBusinessRow, Business } from '@/lib/contracts';
import { accessShareText, displayName, emailStatusOf, expiryInfo, filterRows, needsAttention, parseDateInput, parseStatusFilter, toDateInput } from './helpers';

// 21 nov 2026, 10:00 en Ecuador (15:00 UTC)
const NOW = Date.UTC(2026, 10, 21, 15, 0, 0);
const DAY = 86_400_000;

function row(id: string, b: Partial<Business>, owner?: Partial<NonNullable<AdminBusinessRow['owner']>>): AdminBusinessRow {
  return {
    business: { id, name: 'Café Uno', slug: id, type: 'cafeteria', country: 'EC', currency: 'USD', timezone: 'America/Guayaquil', plan: 'standard', createdAt: new Date(NOW - 10 * DAY).toISOString(), ...b },
    owner: owner ? { staffId: 'emp_' + id, name: 'Ana', email: `${id}@correo.com`, invitePending: false, ...owner } : undefined,
    stats: { customers: 0, stamps30d: 0, redemptions30d: 0 }
  };
}

describe('displayName', () => {
  it('marca los negocios nuevos que siguen configurando', () => {
    expect(displayName({ name: 'Negocio nuevo', status: 'setup' })).toBe('Negocio nuevo · configurando');
    expect(displayName({ name: 'Pizzería Roma', status: 'setup' })).toBe('Pizzería Roma');
    expect(displayName({ name: 'Café Uno' })).toBe('Café Uno');
  });
});

describe('fechas de vencimiento', () => {
  it('lee el input date como el final de ese día en Ecuador', () => {
    expect(parseDateInput('')).toEqual({ value: null });
    expect(parseDateInput('2026-11-30')).toEqual({ value: '2026-12-01T04:59:59.000Z' });
    expect(parseDateInput('2026-02-30')).toEqual({ error: 'La fecha no es válida.' });
    expect(parseDateInput('30/11/2026')).toEqual({ error: 'La fecha no es válida.' });
    expect(toDateInput('2026-12-01T04:59:59.000Z')).toBe('2026-11-30');
    expect(toDateInput(undefined)).toBe('');
  });

  it('avisa en rojo si venció y en ámbar si vence en 7 días o menos', () => {
    const at = (d: string) => (parseDateInput(d) as { value: string }).value;
    expect(expiryInfo(undefined, NOW)).toMatchObject({ tone: 'none', label: 'Sin vencimiento' });
    expect(expiryInfo(at('2026-11-21'), NOW)).toMatchObject({ tone: 'warn', label: 'Vence hoy' });
    expect(expiryInfo(at('2026-11-22'), NOW)).toMatchObject({ tone: 'warn', label: 'Vence mañana' });
    expect(expiryInfo(at('2026-11-28'), NOW)).toMatchObject({ tone: 'warn', label: 'Vence en 7 días' });
    expect(expiryInfo(at('2026-11-29'), NOW).tone).toBe('ok');
    expect(expiryInfo(at('2026-11-20'), NOW)).toMatchObject({ tone: 'bad', label: 'Venció ayer' });
    expect(expiryInfo(at('2026-11-11'), NOW)).toMatchObject({ tone: 'bad', label: 'Venció hace 10 días' });
  });
});

describe('lista de negocios', () => {
  const rows = [
    row('a', { name: 'Panadería Ñuñoa', status: 'active' }, { email: 'luis@pan.ec' }),
    row('b', { name: 'Negocio nuevo', status: 'setup' }, { email: 'nuevo@correo.com', invitePending: true }),
    row('c', { name: 'Barbería', status: 'suspended', planExpiresAt: new Date(NOW - 3 * DAY).toISOString() }),
    row('d', { name: 'Gym', status: 'active', planExpiresAt: new Date(NOW + 3 * DAY).toISOString() }),
    row('e', { name: 'Spa', planExpiresAt: new Date(NOW - 2 * DAY).toISOString() })
  ];

  it('busca por nombre (sin tildes) y por correo', () => {
    expect(filterRows(rows, 'nunoa', 'todos', NOW).map((r) => r.business.id)).toEqual(['a']);
    expect(filterRows(rows, 'LUIS@', 'todos', NOW).map((r) => r.business.id)).toEqual(['a']);
    expect(filterRows(rows, '', 'todos', NOW)).toHaveLength(5);
  });

  it('filtra por estado y vencimiento (los suspendidos no cuentan como vencidos)', () => {
    expect(filterRows(rows, '', 'configurando', NOW).map((r) => r.business.id)).toEqual(['b']);
    expect(filterRows(rows, '', 'activos', NOW).map((r) => r.business.id)).toEqual(['a', 'd', 'e']);
    expect(filterRows(rows, '', 'suspendidos', NOW).map((r) => r.business.id)).toEqual(['c']);
    expect(filterRows(rows, '', 'por-vencer', NOW).map((r) => r.business.id)).toEqual(['d']);
    expect(filterRows(rows, '', 'vencidos', NOW).map((r) => r.business.id)).toEqual(['e']);
  });

  it('ignora filtros desconocidos', () => {
    expect(parseStatusFilter('raro')).toBe('todos');
    expect(parseStatusFilter(['suspendidos'])).toBe('suspendidos');
  });

  it('necesitan atención: vencidos, por vencer e invitaciones pendientes, en ese orden', () => {
    expect(needsAttention(rows, NOW).map((i) => [i.row.business.id, i.reason])).toEqual([['e', 'expired'], ['d', 'expiring'], ['b', 'invite']]);
  });
});

describe('compartir el enlace', () => {
  it('arma el mensaje de WhatsApp y el estado del correo', () => {
    expect(accessShareText('invite', 'https://app.stampaec.app/invitacion/x')).toBe('Hola, ya tienes acceso a Stampa. Crea tu contraseña y configura tu negocio aquí: https://app.stampaec.app/invitacion/x');
    expect(emailStatusOf({ sent: true })).toBe('sent');
    expect(emailStatusOf({ sent: false, preview: true })).toBe('preview');
    expect(emailStatusOf({ sent: false, preview: false })).toBe('failed');
  });
});
