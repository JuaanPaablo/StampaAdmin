import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { ADMIN_AUD, ADMIN_SESSION_SECONDS, signAdminToken, verifyAdminToken } from './admin-session';
import { newPayload, signToken } from './session-token';
import { issued, signData } from './signed';

const SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres';
const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);

describe('sesión de administrador', () => {
  it('ida y vuelta válida y dura 12 horas', () => {
    const t = signAdminToken('adm_demo', NOW, SECRET);
    expect(verifyAdminToken(t, NOW + 1000, SECRET)).toBe('adm_demo');
    expect(ADMIN_SESSION_SECONDS).toBe(12 * 3600);
    expect(verifyAdminToken(t, NOW + (ADMIN_SESSION_SECONDS - 5) * 1000, SECRET)).toBe('adm_demo');
    expect(verifyAdminToken(t, NOW + (ADMIN_SESSION_SECONDS + 5) * 1000, SECRET)).toBeNull();
  });

  it('rechaza tokens manipulados o con otro secreto', () => {
    const t = signAdminToken('adm_demo', NOW, SECRET);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), adminId: 'adm_otro' })).toString('base64url');
    expect(verifyAdminToken(`${forged}.${sig}`, NOW, SECRET)).toBeNull();
    expect(verifyAdminToken(t, NOW, 'otro-secreto-distinto-de-32-caracteres!!')).toBeNull();
    expect(verifyAdminToken('', NOW, SECRET)).toBeNull();
    expect(verifyAdminToken(undefined, NOW, SECRET)).toBeNull();
    expect(verifyAdminToken('basura', NOW, SECRET)).toBeNull();
  });

  it('una sesión del panel de negocios o de cliente no vale como admin', () => {
    const panel = signToken(newPayload('biz_esquina', 'adm_demo', false, NOW), SECRET);
    expect(verifyAdminToken(panel, NOW, SECRET)).toBeNull();
    const cliente = signData({ aud: 'cliente', adminId: 'adm_demo', ...issued(3600, NOW) }, SECRET);
    expect(verifyAdminToken(cliente, NOW, SECRET)).toBeNull();
  });

  it('exige un adminId de texto', () => {
    const sinId = signData({ aud: ADMIN_AUD, ...issued(3600, NOW) }, SECRET);
    expect(verifyAdminToken(sinId, NOW, SECRET)).toBeNull();
    const numerico = signData({ aud: ADMIN_AUD, adminId: 7, ...issued(3600, NOW) } as never, SECRET);
    expect(verifyAdminToken(numerico, NOW, SECRET)).toBeNull();
  });
});
