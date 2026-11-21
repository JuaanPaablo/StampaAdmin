import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_SESSION_SECONDS, PENDING_SECONDS, signCustomerToken, signPendingToken, verifyCustomerToken, verifyPendingToken
} from './customer-session';
import { issued, signData } from './signed';

const now = Date.parse('2026-11-21T12:00:00Z');

describe('sesión del cliente', () => {
  it('firma y verifica el correo en minúsculas', () => {
    const t = signCustomerToken('  Maria@Correo.COM ', now);
    expect(verifyCustomerToken(t, now)).toEqual({ email: 'maria@correo.com' });
  });
  it('dura 365 días', () => {
    expect(CUSTOMER_SESSION_SECONDS).toBe(365 * 86_400);
    const t = signCustomerToken('a@b.com', now);
    expect(verifyCustomerToken(t, now + 364 * 86_400_000)).not.toBeNull();
    expect(verifyCustomerToken(t, now + 366 * 86_400_000)).toBeNull();
  });
  it('rechaza firmas alteradas, otro secreto y basura', () => {
    const t = signCustomerToken('a@b.com', now);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ aud: 'cliente', iat: now / 1000, exp: now / 1000 + 999, email: 'otro@b.com' })).toString('base64url');
    expect(verifyCustomerToken(`${forged}.${sig}`, now)).toBeNull();
    expect(verifyCustomerToken(`${body}.x${sig}`, now)).toBeNull();
    expect(verifyCustomerToken(signCustomerToken('a@b.com', now, 'otro-secreto'), now)).toBeNull();
    expect(verifyCustomerToken(undefined, now)).toBeNull();
    expect(verifyCustomerToken('no-es-token', now)).toBeNull();
  });
  it('un token de otro tipo (admin o pendiente) no vale como sesión', () => {
    const admin = signData({ aud: 'admin', ...issued(3600, now), email: 'a@b.com' });
    expect(verifyCustomerToken(admin, now)).toBeNull();
    const pending = signPendingToken({ mode: 'ingreso', email: 'a@b.com' }, now);
    expect(verifyCustomerToken(pending, now)).toBeNull();
    expect(verifyPendingToken(signCustomerToken('a@b.com', now), now)).toBeNull();
  });
  it('no firma correos inválidos', () => {
    expect(() => signCustomerToken('sin-arroba', now)).toThrow();
  });
});

describe('datos pendientes del alta', () => {
  it('guarda los datos del formulario 15 minutos', () => {
    const t = signPendingToken({ mode: 'alta', email: 'Ana@X.com', slug: 'cafe-la-esquina', name: 'Ana', birthday: { d: 3, m: 4 }, birthdayYear: 1990, stampCode: '123456' }, now);
    const p = verifyPendingToken(t, now + (PENDING_SECONDS - 1) * 1000);
    expect(p).toMatchObject({ mode: 'alta', email: 'ana@x.com', slug: 'cafe-la-esquina', name: 'Ana', stampCode: '123456' });
    expect(verifyPendingToken(t, now + (PENDING_SECONDS + 1) * 1000)).toBeNull();
  });
});
