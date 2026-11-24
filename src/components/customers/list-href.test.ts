import { describe, expect, it } from 'vitest';
import { backHref, detailHref, listHref } from './list-href';

describe('enlaces de la lista de clientes', () => {
  it('omite los valores por defecto', () => {
    expect(listHref({ q: '', segmento: 'todos', orden: 'recientes', pagina: 1 })).toBe('/panel/clientes');
  });
  it('la ficha recuerda los filtros y la vuelta los restaura', () => {
    const d = detailHref('abc', { q: 'ana', segmento: 'en_riesgo', orden: 'sellos', pagina: 2 });
    const volver = decodeURIComponent(d.split('volver=')[1]);
    expect(backHref(volver)).toBe('/panel/clientes?q=ana&segmento=en_riesgo&orden=sellos&pagina=2');
    expect(detailHref('abc', {})).toBe('/panel/clientes/abc');
  });
  it('la vuelta ignora valores desconocidos y nunca sale de la lista', () => {
    expect(backHref('segmento=x&orden=y&pagina=-3&next=https://malo.com')).toBe('/panel/clientes');
    expect(backHref('//malo.com')).toBe('/panel/clientes');
    expect(backHref(undefined)).toBe('/panel/clientes');
  });
});
