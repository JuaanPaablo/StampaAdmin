import { describe, expect, it } from 'vitest';
import {
  birthYears, checkBirthdate, cleanCode, logoInitials, remainingText, rewardPhrase, stampCells, stampColumns,
  stampedText, visitDate, visitRows
} from './card-model';

describe('stampCells', () => {
  it('arma la cuadrícula con el premio al final', () => {
    const cells = stampCells(10, 7);
    expect(cells).toHaveLength(10);
    expect(cells.filter((c) => c.earned)).toHaveLength(7);
    expect(cells[6]).toEqual({ n: 7, earned: true, reward: false });
    expect(cells[7]).toEqual({ n: 8, earned: false, reward: false });
    expect(cells[9]).toEqual({ n: 10, earned: false, reward: true });
    expect(cells.filter((c) => c.reward)).toHaveLength(1);
  });
  it('recorta valores fuera de rango', () => {
    expect(stampCells(8, -3).every((c) => !c.earned)).toBe(true);
    expect(stampCells(8, 99).every((c) => c.earned)).toBe(true);
    expect(stampCells(0, 0)).toHaveLength(1);
  });
  it('elige columnas parejas', () => {
    expect(stampColumns(8)).toBe(4);
    expect(stampColumns(10)).toBe(5);
    expect(stampColumns(12)).toBe(6);
    expect(stampColumns(20)).toBe(5);
  });
});

describe('textos de la tarjeta', () => {
  it('te faltan N', () => {
    expect(remainingText(7, 10, 'Corte gratis')).toBe('Te faltan 3 sellos para tu corte gratis');
    expect(remainingText(9, 10, 'Café gratis')).toBe('Te falta 1 sello para tu café gratis');
    expect(remainingText(0, 8, 'Postre de la casa')).toBe('Te faltan 8 sellos para tu postre de la casa');
    expect(remainingText(10, 10, 'Café gratis')).toBe('¡Ya ganaste tu café gratis!');
    expect(remainingText(12, 10, 'Café gratis')).toBe('¡Ya ganaste tu café gratis!');
  });
  it('mensaje al sellar, como en el manual', () => {
    expect(stampedText(7, 10, 'Corte gratis')).toBe('¡Sello 7 de 10! Te faltan 3 para tu corte gratis.');
    expect(stampedText(9, 10, 'Corte gratis')).toBe('¡Sello 9 de 10! Te falta 1 para tu corte gratis.');
    expect(stampedText(10, 10, 'Corte gratis')).toBe('¡Sello 10 de 10! Ya ganaste tu corte gratis.');
  });
  it('premio vacío', () => {
    expect(rewardPhrase('  ')).toBe('premio');
  });
  it('iniciales del logo', () => {
    expect(logoInitials('CE', 'Café La Esquina')).toBe('CE');
    expect(logoInitials('', 'Barbería Don Lucho')).toBe('BD');
    expect(logoInitials(undefined, 'Pulso')).toBe('PU');
  });
});

describe('últimas visitas', () => {
  it('numera los sellos de la tarjeta actual hacia atrás', () => {
    const rows = visitRows([
      { at: '2026-11-20T15:00:00Z', kind: 'stamp' },
      { at: '2026-11-18T15:00:00Z', kind: 'stamp' },
      { at: '2026-11-10T15:00:00Z', kind: 'redeem' },
      { at: '2026-11-09T15:00:00Z', kind: 'stamp' }
    ], 2, 10);
    expect(rows.map((r) => r.label)).toEqual(['Sello 2', 'Sello 1', 'Premio canjeado', 'Sello 10']);
  });
  it('un premio intermedio no reinicia la numeración', () => {
    const rows = visitRows([
      { at: '2026-11-20T15:03:00Z', kind: 'redeem', milestone: 5, title: 'Galleta' },
      { at: '2026-11-20T15:02:00Z', kind: 'stamp' },
      { at: '2026-11-20T15:01:00Z', kind: 'stamp' }
    ], 5, 10);
    expect(rows.map((r) => r.label)).toEqual(['Premio canjeado: Galleta', 'Sello 5', 'Sello 4']);
  });
  it('fechas relativas en Guayaquil', () => {
    const now = Date.parse('2026-11-21T20:00:00Z'); // 15:00 en Guayaquil
    expect(visitDate('2026-11-21T15:15:00Z', now)).toBe('Hoy, 10:15');
    expect(visitDate('2026-11-20T13:02:00Z', now)).toBe('Ayer, 8:02');
    expect(visitDate('2026-11-02T18:00:00Z', now)).toBe('2 de noviembre');
    expect(visitDate('2025-12-31T18:00:00Z', now)).toBe('31 de diciembre de 2025');
    // 23:30 del 20 en Guayaquil = 04:30 UTC del 21: sigue siendo "ayer" en la zona del negocio.
    expect(visitDate('2026-11-21T04:30:00Z', now)).toBe('Ayer, 23:30');
    expect(visitDate('no-es-fecha', now)).toBe('');
  });
});

describe('fecha de nacimiento', () => {
  const now = Date.parse('2026-11-21T12:00:00Z');
  it('acepta fechas reales', () => {
    expect(checkBirthdate(15, 4, 1990, now)).toEqual({ ok: true, birthday: { d: 15, m: 4 }, year: 1990 });
    expect(checkBirthdate(29, 1, 2000, now).ok).toBe(true);
  });
  it('rechaza fechas imposibles o años fuera de rango', () => {
    expect(checkBirthdate(31, 3, 1990, now).ok).toBe(false);
    expect(checkBirthdate(29, 1, 2001, now).ok).toBe(false);
    expect(checkBirthdate(1, 0, 2024, now).ok).toBe(false);
    expect(checkBirthdate(1, 0, 1900, now).ok).toBe(false);
    expect(checkBirthdate(NaN, 0, 1990, now).ok).toBe(false);
  });
  it('lista de años', () => {
    const ys = birthYears(now);
    expect(ys[0]).toBe(2021);
    expect(ys[ys.length - 1]).toBe(1916);
  });
});

describe('cleanCode', () => {
  it('normaliza 6 dígitos', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('123-456')).toBe('123456');
    expect(cleanCode('12345')).toBeNull();
    expect(cleanCode('abcdef')).toBeNull();
    expect(cleanCode(null)).toBeNull();
  });
});

describe('ayudas del formulario', () => {
  it('sugiere el dominio correcto en correos mal escritos', async () => {
    const { suggestEmail } = await import('./card-model');
    expect(suggestEmail('Ana@Gmial.com')).toBe('ana@gmail.com');
    expect(suggestEmail('luis@hotmail.con')).toBe('luis@hotmail.com');
    expect(suggestEmail('ana@gmail.com')).toBeNull();
    expect(suggestEmail('ana@empresa.ec')).toBeNull();
    expect(suggestEmail('ana@')).toBeNull();
    expect(suggestEmail('')).toBeNull();
  });
  it('días de cada mes', async () => {
    const { daysInMonth } = await import('./card-model');
    expect(daysInMonth(1, 2023)).toBe(28);
    expect(daysInMonth(1, 2024)).toBe(29);
    expect(daysInMonth(1)).toBe(29);
    expect(daysInMonth(3, 1990)).toBe(30);
    expect(daysInMonth(NaN)).toBe(31);
  });
});
