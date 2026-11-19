import { describe, expect, it } from 'vitest';
import { REMEMBER_SECONDS, SESSION_SECONDS, newPayload, signToken, verifyToken } from './session-token';

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres';
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

describe('sesión firmada', () => {
  it('ida y vuelta válida', () => {
    const p = newPayload('biz_a', 'emp_a', false, NOW);
    const t = signToken(p, SECRET);
    expect(verifyToken(t, NOW + 1000, SECRET)).toEqual(p);
    expect(p.exp - p.iat).toBe(SESSION_SECONDS);
  });
  it('vence a las 12 h (30 días con remember)', () => {
    const t = signToken(newPayload('b', 's', false, NOW), SECRET);
    expect(verifyToken(t, NOW + (SESSION_SECONDS - 5) * 1000, SECRET)).not.toBeNull();
    expect(verifyToken(t, NOW + (SESSION_SECONDS + 5) * 1000, SECRET)).toBeNull();
    const r = signToken(newPayload('b', 's', true, NOW), SECRET);
    expect(newPayload('b', 's', true, NOW).exp - Math.floor(NOW / 1000)).toBe(REMEMBER_SECONDS);
    expect(verifyToken(r, NOW + (REMEMBER_SECONDS - 5) * 1000, SECRET)).not.toBeNull();
    expect(verifyToken(r, NOW + (REMEMBER_SECONDS + 5) * 1000, SECRET)).toBeNull();
  });
  it('un token manipulado es inválido', () => {
    const t = signToken(newPayload('biz_a', 'emp_a', false, NOW), SECRET);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), staffId: 'emp_owner' })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, NOW, SECRET)).toBeNull();
    expect(verifyToken(`${body}.${sig.slice(0, -2)}AA`, NOW, SECRET)).toBeNull();
    expect(verifyToken(t, NOW, 'otro-secreto-distinto-de-32-caracteres!!')).toBeNull();
    expect(verifyToken(body, NOW, SECRET)).toBeNull();
    expect(verifyToken('', NOW, SECRET)).toBeNull();
    expect(verifyToken(undefined, NOW, SECRET)).toBeNull();
    expect(verifyToken('a.b.c', NOW, SECRET)).toBeNull();
  });
});
