import { describe, expect, it } from 'vitest';
import { applePassJson, buildPassModel, googleLoyaltyObject, headline } from './pass-model';

const program = {
  name: 'Tarjeta de pizzas', stampsRequired: 10, rewardTitle: 'Pizza mediana', colors: { bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF' },
  logoText: 'PZ', milestones: [{ at: 5, title: 'Bebida' }], terms: 'Un sello por visita.'
};
const biz = { name: 'Pizzería Demo' };
const url = 'https://app.stampaecu.app/u/pizzeria-demo';

describe('pase de Wallet', () => {
  it('calcula progreso y próximo premio', () => {
    const m = buildPassModel(biz, program, { id: 'cus_1', name: 'Ana', stamps: 3 }, url);
    expect(m.progressText).toBe('3 de 10');
    expect(m.nextReward).toEqual({ title: 'Bebida', missing: 2 });
    expect(m.readyReward).toBeNull();
    expect(headline(m)).toBe('Te faltan 2 sellos para Bebida');
  });

  it('marca premio listo en el sello intermedio y al final', () => {
    expect(buildPassModel(biz, program, { id: 'c', name: 'A', stamps: 5 }, url).readyReward).toBe('Bebida');
    const full = buildPassModel(biz, program, { id: 'c', name: 'A', stamps: 10 }, url);
    expect(headline(full)).toBe('¡Premio listo: Pizza mediana!');
  });

  it('solo usa sucursales con coordenadas, máximo 10', () => {
    const locs = Array.from({ length: 12 }, (_, i) => ({ name: `S${i}`, latitude: -0.18 + i / 100, longitude: -78.48 }));
    const m = buildPassModel(biz, program, { id: 'c', name: 'A', stamps: 0 }, url, [{ name: 'Sin GPS' }, ...locs]);
    expect(m.locations).toHaveLength(10);
  });

  it('arma pass.json de Apple y el objeto de Google', () => {
    const m = buildPassModel(biz, program, { id: 'cus_1', name: 'Ana', stamps: 3 }, url);
    const a = applePassJson(m, { passTypeIdentifier: 'pass.app.stampa', teamIdentifier: 'TEAM123' });
    expect(a.serialNumber).toBe('cus_1');
    expect(a.backgroundColor).toBe('rgb(0, 29, 61)');
    expect(a.barcodes[0].message).toBe(url);
    expect(a).not.toHaveProperty('webServiceURL');
    const g = googleLoyaltyObject(m, '3388000000001', 'biz_demo');
    expect(g.id).toBe('3388000000001.cus_1');
    expect(g.loyaltyPoints.balance.string).toBe('3 de 10');
  });
});
