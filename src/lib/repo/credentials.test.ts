import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { DEMO_PASSWORD } from '../seed';

const OWNER = 'andrea@esquina.demo';

function setup() {
  let now = Date.UTC(2026, 5, 1, 12, 0, 0);
  const repo = createMemoryRepo({ clock: () => now });
  return { repo, advance: (ms: number) => { now += ms; } };
}

describe('verifyCredentials (repo en memoria)', () => {
  it('acepta correo y contraseña correctos (correo normalizado)', async () => {
    const { repo } = setup();
    const r = await repo.verifyCredentials(`  ${OWNER.toUpperCase()} `, DEMO_PASSWORD);
    expect(r).not.toBeNull();
    const staff = (await repo.listStaff(r!.businessId)).find((s) => s.id === r!.staffId)!;
    expect(staff.role).toBe('owner');
    expect(staff.email).toBe(OWNER);
    expect(JSON.stringify(staff)).not.toMatch(/hash|scrypt/i);
  });
  it('rechaza mala contraseña y correo inexistente', async () => {
    const { repo } = setup();
    expect(await repo.verifyCredentials(OWNER, 'Stampa-Demo-2027')).toBeNull();
    expect(await repo.verifyCredentials('nadie@nada.demo', DEMO_PASSWORD)).toBeNull();
    expect(await repo.verifyCredentials('', '')).toBeNull();
  });
  it('rechaza cuentas inactivas', async () => {
    const { repo } = setup();
    const biz = (await repo.listBusinesses()).find((b) => b.id === 'biz_esquina')!;
    const pedro = (await repo.listStaff(biz.id)).find((s) => s.email === 'pedro@esquina.demo')!;
    expect(await repo.verifyCredentials('pedro@esquina.demo', DEMO_PASSWORD)).not.toBeNull();
    await repo.upsertStaff(biz.id, { id: pedro.id, name: pedro.name, role: pedro.role, active: false });
    expect(await repo.verifyCredentials('pedro@esquina.demo', DEMO_PASSWORD)).toBeNull();
  });
  it('bloquea 15 minutos tras 5 fallos seguidos, incluso con la contraseña correcta', async () => {
    const { repo, advance } = setup();
    for (let i = 0; i < 4; i++) expect(await repo.verifyCredentials(OWNER, 'mala-clave-' + i)).toBeNull();
    expect(await repo.isLoginLocked(OWNER)).toBe(false);
    expect(await repo.verifyCredentials(OWNER, 'mala-clave-4')).toBeNull();
    expect(await repo.isLoginLocked(OWNER)).toBe(true);
    expect(await repo.verifyCredentials(OWNER, DEMO_PASSWORD)).toBeNull();
    advance(14 * 60_000);
    expect(await repo.verifyCredentials(OWNER, DEMO_PASSWORD)).toBeNull();
    advance(2 * 60_000);
    expect(await repo.isLoginLocked(OWNER)).toBe(false);
    expect(await repo.verifyCredentials(OWNER, DEMO_PASSWORD)).not.toBeNull();
  });
  it('un acierto reinicia el conteo de fallos', async () => {
    const { repo } = setup();
    for (let i = 0; i < 4; i++) await repo.verifyCredentials(OWNER, 'mala-clave-' + i);
    expect(await repo.verifyCredentials(OWNER, DEMO_PASSWORD)).not.toBeNull();
    for (let i = 0; i < 4; i++) await repo.verifyCredentials(OWNER, 'mala-clave-' + i);
    expect(await repo.isLoginLocked(OWNER)).toBe(false);
  });
  it('los correos inexistentes se bloquean igual (no revela cuáles existen)', async () => {
    const { repo } = setup();
    for (let i = 0; i < 5; i++) await repo.verifyCredentials('fantasma@nada.demo', 'x' + i);
    expect(await repo.isLoginLocked('fantasma@nada.demo')).toBe(true);
  });
});

describe('setStaffCredentials', () => {
  it('aplica la política y la unicidad del correo', async () => {
    const { repo } = setup();
    const staff = (await repo.listStaff('biz_esquina'))[0];
    await expect(repo.setStaffCredentials(staff.id, 'nuevo@cafe.com', 'corta')).rejects.toThrow(/10/);
    await expect(repo.setStaffCredentials(staff.id, 'no-es-correo', 'una-clave-larga-1')).rejects.toThrow(/correo/);
    await expect(repo.setStaffCredentials(staff.id, 'pedro@esquina.demo', 'una-clave-larga-1')).rejects.toThrow(/en uso/);
    await repo.setStaffCredentials(staff.id, 'Nuevo@Cafe.com', 'una-clave-larga-1');
    expect(await repo.verifyCredentials('nuevo@cafe.com', 'una-clave-larga-1')).toEqual({ businessId: 'biz_esquina', staffId: staff.id });
  });
  it('el PIN ya no sirve como credencial de entrada', async () => {
    const { repo } = setup();
    expect(await repo.verifyCredentials(OWNER, '1234')).toBeNull();
  });
});
