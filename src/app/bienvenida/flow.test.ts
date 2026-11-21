import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '@/lib/repo/memory';
import { statusRedirect } from '@/lib/context';
import { customerUrl, stampUrl } from '@/lib/urls';
import type { Business, Staff } from '@/lib/contracts';
import { accessStatus } from '@/components/team/schema';
import { checkImageFile, safeImageUrl } from '@/components/card/images';
import { birthdayLabel } from '@/components/customers/contact';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const biz = (status?: Business['status']) => ({ status } as Business);
const who = (role: Staff['role']) => ({ role } as Staff);

describe('estados del negocio en el panel', () => {
  it('setup manda a /bienvenida; suspendido a /suspendido; activo deja pasar', () => {
    expect(statusRedirect({ business: biz('setup'), staff: who('owner') })).toBe('/bienvenida');
    expect(statusRedirect({ business: biz('setup'), staff: who('cashier') })).toBe('/bienvenida');
    expect(statusRedirect({ business: biz('suspended'), staff: who('owner') })).toBe('/suspendido');
    expect(statusRedirect({ business: biz('active'), staff: who('cashier') })).toBeNull();
    expect(statusRedirect({ business: biz(undefined), staff: who('manager') })).toBeNull();
  });

  it('allowSetup solo deja pasar al dueño (acciones compartidas con el asistente)', () => {
    expect(statusRedirect({ business: biz('setup'), staff: who('owner') }, { allowSetup: true })).toBeNull();
    expect(statusRedirect({ business: biz('setup'), staff: who('manager') }, { allowSetup: true })).toBe('/bienvenida');
    expect(statusRedirect({ business: biz('suspended'), staff: who('owner') }, { allowSetup: true })).toBe('/suspendido');
  });
});

describe('asistente de bienvenida con el repo en memoria', () => {
  it('nombre → imagen → sucursal → tarjeta → listo deja el negocio activo con slug, logo y QR reales', async () => {
    const repo = createMemoryRepo();
    const { business, ownerId } = await repo.createBusinessAccess({ ownerEmail: 'nuevo@prueba.ec', plan: 'negocio' });
    expect(business.status).toBe('setup');

    // No se puede activar sin nombre real ni sucursal.
    await expect(repo.completeBusinessSetup(business.id, ownerId)).rejects.toThrow();

    const saved = await repo.saveBusinessSetup(business.id, { name: 'Panadería El Trigal', type: 'panaderia', city: 'Cuenca' }, ownerId);
    expect(saved.slug).toBe('panaderia-el-trigal');

    const logo = await repo.uploadBusinessImage(business.id, 'logo', { bytes: PNG, contentType: 'image/png' });
    expect(safeImageUrl(logo)).toBe(logo);
    await expect(repo.uploadBusinessImage(business.id, 'cover', { bytes: PNG, contentType: 'image/jpeg' })).rejects.toThrow(/imagen/);

    await repo.upsertLocation(business.id, { name: 'Principal', address: 'Av. Solano 1-23' });
    await repo.updateProgram(business.id, { stampsRequired: 8, rewardTitle: 'Pan gratis', requireAmount: true, minSpendCentsPerStamp: 300, birthdayReward: 'Un pastel' }, ownerId);

    const done = await repo.completeBusinessSetup(business.id, ownerId);
    expect(done.status).toBe('active');
    const program = await repo.getProgram(business.id);
    expect(program).toMatchObject({ stampsRequired: 8, rewardTitle: 'Pan gratis', logoUrl: logo });

    // Después de activarse el slug ya no cambia (el QR impreso depende de él).
    const renamed = await repo.saveBusinessSetup(business.id, { name: 'El Trigal', type: 'panaderia' }, ownerId);
    expect(renamed.slug).toBe('panaderia-el-trigal');
    expect(customerUrl(renamed.slug)).toMatch(/\/u\/panaderia-el-trigal$/);
    expect(stampUrl(renamed.slug, '123456')).toMatch(/\/u\/panaderia-el-trigal\/sello\?c=123456$/);
  });

  it('invitar a alguien del equipo: correo, enlace y estado de acceso', async () => {
    const repo = createMemoryRepo();
    const { business, ownerId } = await repo.createBusinessAccess({ ownerEmail: 'duena@prueba.ec', plan: 'gratis' });
    const cashier = await repo.upsertStaff(business.id, { name: 'Lucía Cajas', role: 'cashier', active: true }, '4826', ownerId);
    expect(accessStatus(cashier)).toBe('none');
    const withEmail = await repo.setStaffEmail(business.id, cashier.id, 'Lucia@Prueba.ec', ownerId);
    expect(withEmail.email).toBe('lucia@prueba.ec');
    const token = await repo.issueAccessToken(cashier.id, 'invite');
    expect(token.token.length).toBeGreaterThan(20);
    const info = await repo.peekAccessToken(token.token);
    expect(info?.staffId).toBe(cashier.id);
    await expect(repo.setStaffEmail(business.id, cashier.id, 'duena@prueba.ec', ownerId)).rejects.toThrow(/correo/);
  });
});

describe('ayudas de la interfaz', () => {
  it('estado de acceso', () => {
    expect(accessStatus({})).toBe('none');
    expect(accessStatus({ email: 'a@b.ec', invitePending: true })).toBe('pending');
    expect(accessStatus({ email: 'a@b.ec' })).toBe('active');
  });

  it('valida imágenes en el navegador y solo sirve URLs seguras', () => {
    expect(checkImageFile({ type: 'image/gif', size: 10 })).toMatch(/PNG/);
    expect(checkImageFile({ type: 'image/png', size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
    expect(checkImageFile({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(safeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeImageUrl('data:image/svg+xml;base64,AAAA')).toBeUndefined();
    expect(safeImageUrl('https://cdn.ejemplo.ec/logo.png')).toBe('https://cdn.ejemplo.ec/logo.png');
  });

  it('fecha de nacimiento completa si hay año', () => {
    expect(birthdayLabel({ birthday: { d: 3, m: 4 }, birthdayYear: 1990 })).toBe('3 de mayo de 1990');
    expect(birthdayLabel({ birthday: { d: 3, m: 4 } })).toBe('3 de mayo');
    expect(birthdayLabel({})).toBeNull();
  });
});
