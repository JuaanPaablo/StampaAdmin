import { describe, expect, it } from 'vitest';
import {
  addDays, campaignsLeftText, dayLabel, daysInclusive, friendlyError, offerFormDefaults, offerInputFromForm, parseDuration,
  parseSentQuery, readOfferForm, resolveEndDay, sendResultMessage, validityLabel, type OfferFormValues
} from './offer-form';

// 2026-11-26 12:00 en Ecuador (17:00 UTC)
const NOW = Date.parse('2026-11-26T17:00:00Z');

const base: OfferFormValues = {
  title: '2x1 en capuchinos', description: 'Trae a un amigo y paga uno.', terms: '', imageUrl: '',
  startDay: '2026-11-26', mode: 'days', days: '7', endDay: ''
};

describe('fechas', () => {
  it('suma días y cuenta días inclusivos', () => {
    expect(addDays('2026-11-26', 6)).toBe('2026-12-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysInclusive('2026-12-01', '2026-12-07')).toBe(7);
    expect(daysInclusive('2026-12-01', '2026-12-01')).toBe(1);
  });

  it('lee la duración', () => {
    expect(parseDuration('7')).toBe(7);
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('400')).toBeNull();
    expect(parseDuration('2,5')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('resuelve el último día por duración o por fecha', () => {
    expect(resolveEndDay(base)).toBe('2026-12-02');
    expect(resolveEndDay({ ...base, mode: 'end', endDay: '2026-12-10' })).toBe('2026-12-10');
    expect(resolveEndDay({ ...base, mode: 'end', endDay: '' })).toBeNull();
    expect(resolveEndDay({ ...base, startDay: 'x' })).toBeNull();
  });
});

describe('readOfferForm', () => {
  it('lee FormData y objetos', () => {
    const fd = new FormData();
    fd.set('title', ' Hola '); fd.set('mode', 'end'); fd.set('endDay', '2026-12-01'); fd.set('startDay', '2026-11-30');
    const v = readOfferForm(fd);
    expect(v.title).toBe(' Hola ');
    expect(v.mode).toBe('end');
    expect(v.endDay).toBe('2026-12-01');
    expect(readOfferForm({ mode: 'raro' }).mode).toBe('days');
  });
});

describe('offerInputFromForm', () => {
  it('arma la vigencia en horario de Ecuador', () => {
    const r = offerInputFromForm(base, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.startsAt).toBe('2026-11-26T05:00:00.000Z');
    expect(r.input.endsAt).toBe('2026-12-03T04:59:59.000Z');
    expect(r.input.terms).toBeUndefined();
  });

  it('marca el campo correcto', () => {
    expect(offerInputFromForm({ ...base, title: '' }, NOW)).toEqual({ ok: false, fieldErrors: { title: 'Escribe el título del cupón.' } });
    const long = offerInputFromForm({ ...base, title: 'x'.repeat(41) }, NOW);
    expect(!long.ok && long.fieldErrors.title).toMatch(/40/);
    const img = offerInputFromForm({ ...base, imageUrl: 'http://a.com/x.png' }, NOW);
    expect(!img.ok && img.fieldErrors.imageUrl).toMatch(/https/);
    const noDays = offerInputFromForm({ ...base, days: '' }, NOW);
    expect(!noDays.ok && noDays.fieldErrors.days).toBeTruthy();
    const noEnd = offerInputFromForm({ ...base, mode: 'end', endDay: '' }, NOW);
    expect(!noEnd.ok && noEnd.fieldErrors.endDay).toBeTruthy();
    const before = offerInputFromForm({ ...base, mode: 'end', endDay: '2026-11-20' }, NOW);
    expect(!before.ok && before.fieldErrors.endDay).toBeTruthy();
    const past = offerInputFromForm({ ...base, startDay: '2026-11-01', days: '3' }, NOW);
    expect(!past.ok && past.fieldErrors.days).toMatch(/pasó/);
    const noStart = offerInputFromForm({ ...base, startDay: '' }, NOW);
    expect(!noStart.ok && noStart.fieldErrors.startDay).toBeTruthy();
  });
});

describe('offerFormDefaults', () => {
  it('nuevo: hoy y 7 días', () => {
    const d = offerFormDefaults(undefined, NOW);
    expect(d.startDay).toBe('2026-11-26');
    expect(d.days).toBe('7');
    expect(d.endDay).toBe('2026-12-02');
  });
  it('borrador: sus fechas en Ecuador', () => {
    const d = offerFormDefaults({ title: 'A', description: 'B', startsAt: '2026-12-01T05:00:00.000Z', endsAt: '2026-12-08T04:59:59.000Z' }, NOW);
    expect(d).toMatchObject({ startDay: '2026-12-01', endDay: '2026-12-07', mode: 'end', days: '7', terms: '' });
  });
});

describe('textos', () => {
  it('fechas legibles', () => {
    expect(dayLabel('2026-12-05', NOW)).toBe('5 de diciembre');
    expect(dayLabel('2027-01-05', NOW)).toBe('5 de enero de 2027');
    expect(validityLabel('2026-12-01', '2026-12-07', NOW)).toBe('Válido del 1 al 7 de diciembre');
    expect(validityLabel('2026-11-28', '2026-12-03', NOW)).toBe('Válido del 28 de noviembre al 3 de diciembre');
    expect(validityLabel('2026-12-05', '2026-12-05', NOW)).toBe('Válido solo el 5 de diciembre');
    expect(validityLabel('', null, NOW)).toBe('Elige las fechas');
  });

  it('campañas restantes', () => {
    expect(campaignsLeftText(2, 2)).toBe('Te quedan 2 envíos este mes (de 2).');
    expect(campaignsLeftText(1, 8)).toBe('Te queda 1 envío este mes (de 8).');
    expect(campaignsLeftText(0, 2)).toMatch(/Ya enviaste los 2 cupones/);
    expect(campaignsLeftText(0, 0)).toMatch(/no incluye/);
  });

  it('resultado del envío', () => {
    expect(sendResultMessage({ total: 0, notified: 0, skipped: 0 })).toMatch(/nadie lo recibió/);
    expect(sendResultMessage({ total: 3, notified: 3, skipped: 0 })).toBe('Cupón enviado a 3 clientes. A todos les llegó un aviso al celular.');
    const mixed = sendResultMessage({ total: 10, notified: 4, skipped: 6 });
    expect(mixed).toMatch(/A 4 personas les llegó/);
    expect(mixed).toMatch(/Las otras 6 lo verán/);
    expect(mixed).toMatch(/3 al día/);
    expect(sendResultMessage({ total: 5, notified: 0, skipped: 5 })).toMatch(/no enviamos avisos/);
    expect(sendResultMessage({ total: 2, notified: 1, skipped: 1 }, { customer: 'socio', customers: 'socios' })).toMatch(/2 socios.*A 1 persona le llegó.*La otra lo verá/);
  });
});

describe('friendlyError', () => {
  it('muestra reglas en español y oculta errores técnicos', () => {
    expect(friendlyError(new Error('Saldo insuficiente: quedan $5,00.'), 'X')).toBe('Saldo insuficiente: quedan $5,00.');
    expect(friendlyError(new Error('Tu plan Standard permite enviar 2 cupones por mes. Ya llegaste al límite de este mes.'), 'X')).toMatch(/^Tu plan/);
    expect(friendlyError(new Error('Cupón: duplicate key value violates unique constraint'), 'X')).toBe('X');
    expect(friendlyError(new Error('fetch failed'), 'X')).toBe('X');
    expect(friendlyError('nada', 'X')).toBe('X');
  });
});

describe('parseSentQuery', () => {
  it('lee total.avisados', () => {
    expect(parseSentQuery('10.4')).toEqual({ total: 10, notified: 4, skipped: 6 });
    expect(parseSentQuery('0.0')).toEqual({ total: 0, notified: 0, skipped: 0 });
    expect(parseSentQuery('3.5')).toBeNull();
    expect(parseSentQuery('abc')).toBeNull();
    expect(parseSentQuery(undefined)).toBeNull();
  });
});
