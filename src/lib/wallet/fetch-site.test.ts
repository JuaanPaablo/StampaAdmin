import { describe, expect, it } from 'vitest';
import { sameSiteNavigation } from './fetch-site';

const req = (site?: string) => new Request('https://stampaecu.app/u/x/wallet/apple', { headers: site ? { 'sec-fetch-site': site } : {} });

describe('sameSiteNavigation', () => {
  it('acepta sin encabezado, same-origin y none', () => {
    expect(sameSiteNavigation(req())).toBe(true);
    expect(sameSiteNavigation(req('same-origin'))).toBe(true);
    expect(sameSiteNavigation(req('none'))).toBe(true);
  });
  it('rechaza cross-site y same-site', () => {
    expect(sameSiteNavigation(req('cross-site'))).toBe(false);
    expect(sameSiteNavigation(req('same-site'))).toBe(false);
  });
});
