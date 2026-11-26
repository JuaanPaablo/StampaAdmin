import { describe, expect, it, vi } from 'vitest';
import { appleWalletEnabled } from './index';
import { appleWalletConfig } from './config';

const b64 = (s: string) => Buffer.from(s).toString('base64');
const CERT = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
const KEY = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';
const full = {
  APPLE_PASS_TYPE_ID: 'pass.app.stampa.tarjetas',
  APPLE_TEAM_ID: 'AB12CD34EF',
  APPLE_PASS_CERT_PEM_BASE64: b64(CERT),
  APPLE_PASS_KEY_PEM_BASE64: b64(KEY),
  APPLE_WWDR_PEM_BASE64: b64(CERT),
  APPLE_PASS_AUTH_SECRET: 'x'.repeat(40)
};
const env = (over: Record<string, string | undefined> = {}) => ({ ...full, ...over }) as unknown as NodeJS.ProcessEnv;

describe('Apple Wallet: configuración', () => {
  it('sin variables queda desactivado sin avisar', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(appleWalletEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('con todas las variables válidas se activa (la contraseña de la clave es opcional)', () => {
    expect(appleWalletEnabled(env())).toBe(true);
    const c = appleWalletConfig(env({ APPLE_PASS_KEY_PASSWORD: 'clave' }))!;
    expect(c.passTypeId).toBe('pass.app.stampa.tarjetas');
    expect(c.keyPassword).toBe('clave');
    expect(c.certPem).toContain('BEGIN CERTIFICATE');
  });

  it('una variable faltante o mal pegada lo desactiva y solo nombra la variable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(appleWalletEnabled(env({ APPLE_TEAM_ID: 'abc' }))).toBe(false);
    expect(appleWalletEnabled(env({ APPLE_PASS_TYPE_ID: 'app.stampa' }))).toBe(false);
    expect(appleWalletEnabled(env({ APPLE_PASS_CERT_PEM_BASE64: b64('no es pem') }))).toBe(false);
    expect(appleWalletEnabled(env({ APPLE_PASS_KEY_PEM_BASE64: undefined }))).toBe(false);
    expect(appleWalletEnabled(env({ APPLE_PASS_AUTH_SECRET: 'corto' }))).toBe(false);
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('APPLE_PASS_AUTH_SECRET');
    expect(logged).not.toContain('corto');
    spy.mockRestore();
  });
});
