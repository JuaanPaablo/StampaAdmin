import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('acepta rutas del panel', () => {
    expect(safeNext('/panel')).toBe('/panel');
    expect(safeNext('/panel/caja')).toBe('/panel/caja');
    expect(safeNext('/panel/clientes?q=ana')).toBe('/panel/clientes?q=ana');
  });
  it('rechaza todo lo demás (open redirect)', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '/otra', '/panelx', '/panel/../../x\n', 'javascript:alert(1)', '', '   ', null, undefined, 42, '/panel\\@evil.com']) {
      expect(safeNext(bad)).toBe('/panel');
    }
  });
});
