import { describe, expect, it } from 'vitest';
import { hashPassword, validatePassword, verifyPassword } from './password';

const FAST = { N: 1024, r: 8, p: 1 };

describe('password', () => {
  it('genera el formato scrypt$N$r$p$salt$hash con sal aleatoria', async () => {
    const a = await hashPassword('una-clave-larga-1', FAST);
    const b = await hashPassword('una-clave-larga-1', FAST);
    const parts = a.split('$');
    expect(parts).toHaveLength(6);
    expect(parts.slice(0, 4)).toEqual(['scrypt', '1024', '8', '1']);
    expect(Buffer.from(parts[4], 'base64')).toHaveLength(16);
    expect(a).not.toContain('una-clave-larga-1');
    expect(a).not.toBe(b);
  });
  it('verifica la correcta y rechaza la incorrecta', async () => {
    const h = await hashPassword('una-clave-larga-1', FAST);
    expect(await verifyPassword('una-clave-larga-1', h)).toBe(true);
    expect(await verifyPassword('una-clave-larga-2', h)).toBe(false);
    expect(await verifyPassword('', h)).toBe(false);
  });
  it('un hash ausente o mal formado nunca verifica', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'texto-plano')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$3$8$1$AAAA$BBBB')).toBe(false);
  });
  it('política: mínimo 10 caracteres', () => {
    expect(validatePassword('corta123')).toMatch(/10/);
    expect(validatePassword('1234567890')).toBeNull();
  });
});
