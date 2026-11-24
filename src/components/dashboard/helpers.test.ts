import { describe, expect, it } from 'vitest';
import { delta, previousLabel, rangeDates } from './helpers';

describe('delta', () => {
  it('sin datos en ambos periodos no muestra nada', () => {
    expect(delta(0, 0)).toBeUndefined();
  });
  it('sin base previa es neutral, no "bueno"', () => {
    expect(delta(5, 0)?.dir).toBe('new');
  });
  it('sube y baja con flecha y palabras', () => {
    expect(delta(112, 100)).toMatchObject({ value: '12 %', dir: 'up', good: true, words: '12 % más que el periodo anterior' });
    expect(delta(80, 100)).toMatchObject({ value: '20 %', dir: 'down', good: false, words: '20 % menos que el periodo anterior' });
    expect(delta(100, 100)?.dir).toBe('flat');
  });
  it('con bases chicas usa el múltiplo', () => {
    expect(delta(23, 1)).toMatchObject({ value: '×23', dir: 'up' });
  });
});

describe('rango', () => {
  it('nombra el periodo de comparación', () => {
    expect(previousLabel('30d')).toBe('los 30 días anteriores');
  });
  it('da las fechas del rango en la zona del negocio', () => {
    expect(rangeDates('7d', 'America/Guayaquil', new Date('2026-11-24T15:00:00Z'))).toBe('18 nov – 24 nov');
  });
});
