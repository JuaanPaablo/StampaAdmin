import { describe, expect, it } from 'vitest';
import type { AdminBusinessRow, Business } from '@/lib/contracts';
import {
  accessShareText, amountInput, applyListFilters, businessesCsv, csvCell, displayName, emailStatusOf, expiryInfo, filterRows, formatDateTime,
  lastStampText, listQuery, needsAttention, ownerWhatsappText, parseDateInput, parseListParams, passwordHint, parseStatusFilter,
  relativeTime, rowHealth, sortRows, staffAccessLabel, toDateInput
} from './helpers';

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
    expect(accessShareText('invite', 'https://app.stampaecu.app/invitacion/x')).toBe('Hola, ya tienes acceso a Stampa. Crea tu contraseña y configura tu negocio aquí: https://app.stampaecu.app/invitacion/x');
    expect(emailStatusOf({ sent: true })).toBe('sent');
    expect(emailStatusOf({ sent: false, preview: true })).toBe('preview');
    expect(emailStatusOf({ sent: false, preview: false })).toBe('failed');
  });
});

describe('ayuda en vivo de la contraseña', () => {
  it('muestra el mínimo, cuánto falta y cuándo ya alcanza', () => {
    expect(passwordHint('', 10)).toEqual({ ok: false, text: 'Mínimo 10 caracteres', extra: undefined });
    expect(passwordHint('abcdef', 10)).toEqual({ ok: false, text: 'Mínimo 10 caracteres', extra: ' · faltan 4' });
    expect(passwordHint('abcdefghij', 10)).toEqual({ ok: true, text: '10 caracteres o más' });
  });

  it('dice si la confirmación coincide (nada mientras está vacía)', () => {
    expect(passwordHint('', undefined, 'secreta-123')).toBeNull();
    expect(passwordHint('secreta', undefined, 'secreta-123')).toEqual({ ok: false, text: 'Aún no coinciden' });
    expect(passwordHint('secreta-123', undefined, 'secreta-123')).toEqual({ ok: true, text: 'Coinciden' });
    expect(passwordHint('algo')).toBeNull();
  });
});

describe('lista de negocios: salud, plan, orden y teléfono', () => {
  const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
  const withStats = (r: AdminBusinessRow, s: Partial<AdminBusinessRow['stats']>, extra: Partial<AdminBusinessRow> = {}): AdminBusinessRow =>
    ({ ...r, ...extra, stats: { ...r.stats, ...s } });
  const rows = [
    withStats(row('verde', { name: 'Café Verde', status: 'active', plan: 'pro', createdAt: iso(60 * DAY) }), { customers: 40, stamps30d: 90, lastStampAt: iso(1 * DAY) }, { ownerPhone: '+593991234567' }),
    withStats(row('amar', { name: 'Ámbar Spa', status: 'active', plan: 'basico', createdAt: iso(50 * DAY), planExpiresAt: iso(-20 * DAY) }), { customers: 10, stamps30d: 5, lastStampAt: iso(10 * DAY) }),
    withStats(row('rojo', { name: 'Barbería Roja', status: 'active', createdAt: iso(40 * DAY) }), { customers: 3, stamps30d: 0 }),
    withStats(row('setup', { name: 'Negocio nuevo', status: 'setup', createdAt: iso(1 * DAY) }), {})
  ];
  const ids = (rs: AdminBusinessRow[]) => rs.map((r) => r.business.id);

  it('calcula el semáforo de cada fila', () => {
    expect(rows.map((r) => rowHealth(r, NOW))).toEqual(['green', 'yellow', 'red', 'none']);
  });

  it('combina salud, plan y estado', () => {
    expect(ids(applyListFilters(rows, parseListParams({ salud: 'amarillo' }), NOW))).toEqual(['amar']);
    expect(ids(applyListFilters(rows, parseListParams({ plan: 'standard' }), NOW))).toEqual(['rojo', 'setup']);
    expect(ids(applyListFilters(rows, parseListParams({ plan: 'standard', estado: 'activos', salud: 'rojo' }), NOW))).toEqual(['rojo']);
    expect(ids(applyListFilters(rows, parseListParams({ salud: 'raro', plan: 'gratis' }), NOW))).toHaveLength(4);
  });

  it('busca por celular en formato local o internacional', () => {
    expect(ids(filterRows(rows, '099 123', 'todos', NOW))).toEqual(['verde']);
    expect(ids(filterRows(rows, '+593 99 123 4567', 'todos', NOW))).toEqual(['verde']);
    expect(ids(filterRows(rows, '4567', 'todos', NOW))).toEqual(['verde']);
    expect(ids(filterRows(rows, '12', 'todos', NOW))).toEqual([]);
  });

  it('ordena por columna; lo que no tiene valor va al final', () => {
    expect(ids(sortRows(rows, 'nombre', 'asc'))).toEqual(['amar', 'rojo', 'verde', 'setup']);
    expect(ids(sortRows(rows, 'clientes', 'desc'))).toEqual(['verde', 'amar', 'rojo', 'setup']);
    expect(ids(sortRows(rows, 'ultimo-sello', 'desc'))).toEqual(['verde', 'amar', 'rojo', 'setup']);
    expect(ids(sortRows(rows, 'ultimo-sello', 'asc'))).toEqual(['amar', 'verde', 'rojo', 'setup']);
    expect(ids(sortRows(rows, 'vence', 'asc'))[0]).toBe('amar');
    expect(ids(sortRows(rows, 'creado', 'desc'))).toEqual(['setup', 'rojo', 'amar', 'verde']);
  });

  it('lee y arma la query string sin valores por defecto', () => {
    const p = parseListParams(new URLSearchParams('q=café&estado=activos&salud=rojo&orden=clientes'));
    expect(p).toEqual({ q: 'café', estado: 'activos', salud: 'rojo', plan: 'todos', orden: 'clientes', dir: 'desc' });
    expect(listQuery(p)).toBe('?q=caf%C3%A9&estado=activos&salud=rojo&orden=clientes');
    expect(listQuery(p, { dir: 'asc' })).toBe('?q=caf%C3%A9&estado=activos&salud=rojo&orden=clientes&dir=asc');
    expect(listQuery(parseListParams({}))).toBe('');
    expect(parseListParams({ orden: 'toString' }).orden).toBe('creado');
    expect(parseListParams({ ordenar: 'vence.desc', orden: 'nombre', dir: 'asc' })).toMatchObject({ orden: 'vence', dir: 'desc' });
    expect(parseListParams({ ordenar: 'raro.desc', orden: 'nombre' })).toMatchObject({ orden: 'nombre', dir: 'asc' });
  });

  it('dice hace cuánto fue el último sello', () => {
    expect(lastStampText(undefined, NOW)).toBe('Nunca selló');
    expect(lastStampText(iso(3600_000), NOW)).toBe('hoy');
    expect(lastStampText(iso(DAY), NOW)).toBe('ayer');
    expect(lastStampText(iso(5 * DAY), NOW)).toBe('hace 5 días');
  });
});

describe('exportar CSV', () => {
  it('neutraliza fórmulas y escapa comillas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    for (const c of ['+1', '-1', '@a', '\tx', '\rx']) expect(csvCell(c).startsWith(`"'`)).toBe(true);
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(12)).toBe('"12"');
  });

  it('lleva BOM, encabezados en español y el celular en formato local', () => {
    const r: AdminBusinessRow = { ...row('x', { name: '=Malo', status: 'active' }, { name: 'Ana Pérez' }), ownerPhone: '+593991234567', note: 'Nota "interna"' };
    const csv = businessesCsv([r], NOW);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [head, line] = csv.slice(1).split('\r\n');
    expect(head.startsWith('"Negocio","Dirección pública","Estado","Plan"')).toBe(true);
    expect(line).toContain(`"'=Malo"`);
    expect(line).toContain('"099 123 4567"');
    expect(line).toContain('"Nota ""interna"""');
    expect(line).toContain('"Activo","Standard","$54,99"');
  });
});

describe('ficha del negocio', () => {
  it('fechas con hora de Ecuador y tiempo relativo', () => {
    expect(formatDateTime('2026-11-21T15:05:00.000Z')).toBe('21 nov 2026, 10:05');
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('hace un momento');
    expect(relativeTime(new Date(NOW - 20 * 60_000).toISOString(), NOW)).toBe('hace 20 min');
    expect(relativeTime(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe('hace 3 días');
  });

  it('acceso del equipo y monto del formulario de pago', () => {
    expect(staffAccessLabel({ hasPassword: true, invitePending: false })).toBe('Con contraseña');
    expect(staffAccessLabel({ email: 'a@b.ec', hasPassword: false, invitePending: true })).toBe('Invitación pendiente');
    expect(staffAccessLabel({ hasPassword: false, invitePending: false })).toBe('Sin acceso al panel');
    expect(amountInput(5499)).toBe('54,99');
    expect(amountInput(123456)).toBe('1234,56');
  });

  it('mensaje de WhatsApp al dueño: cobro si vence pronto; saludo si está al día', () => {
    const due = row('w', { name: 'Gym Max', status: 'active', planExpiresAt: new Date(NOW + 3 * DAY).toISOString() }, { name: 'Luis Andrade' });
    expect(ownerWhatsappText(due, NOW)).toBe('Hola Luis, te saluda el equipo de Stampa. Tu plan Standard vence el 24 nov 2026. Para renovarlo son $54,99 al mes. ¿Te ayudo con el pago?');
    const ok = row('k', { name: 'Gym Max', status: 'active' }, { name: 'Luis' });
    expect(ownerWhatsappText(ok, NOW)).toBe('Hola Luis, te saluda el equipo de Stampa. ¿Cómo te va con Gym Max? Si necesitas algo, aquí estamos.');
  });
});
