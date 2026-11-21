import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { INVITE_TTL_HOURS, RESET_TTL_MINUTES } from '../contracts';
import { OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_TTL_MINUTES, PLACEHOLDER_BUSINESS_NAME } from '../mvp-rules';

/** Pruebas del MVP contra el repo en memoria (la implementación de referencia que supabase.ts debe imitar). */

const HOUR = 3_600_000;
const MIN = 60_000;
const PASSWORD = 'Contrasena-Segura-2026';
const LINK_INVALID = 'Este enlace ya no es válido. Pide uno nuevo.';
const EMAIL_TAKEN = 'Ese correo ya tiene acceso a Stampa.';

function setup() {
  let now = Date.UTC(2026, 10, 21, 15, 0, 0);
  const repo = createMemoryRepo({ seed: false, clock: () => now });
  return { repo, now: () => now, advance: (ms: number) => { now += ms; } };
}

/** Negocio nuevo con su dueño ya con contraseña, nombre real, sucursal y asistente terminado. */
async function activeBusiness(repo: ReturnType<typeof setup>['repo'], email: string, name: string) {
  const { business, ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: email, plan: 'negocio' });
  await repo.consumeAccessToken(invite.token, PASSWORD, 'Dueña Prueba');
  await repo.saveBusinessSetup(business.id, { name, type: 'cafeteria', city: 'Quito' }, ownerId);
  await repo.upsertLocation(business.id, { name: 'Principal', address: 'Av. Amazonas' });
  const done = await repo.completeBusinessSetup(business.id, ownerId);
  return { business: done, ownerId };
}

const otherCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

describe('alta de negocio por Stampa e invitación', () => {
  it('createBusinessAccess → peek → consume → verifyCredentials', async () => {
    const { repo, now } = setup();
    const { business, ownerId, invite } = await repo.createBusinessAccess({
      ownerEmail: '  Duena@Pizzeria.EC ', plan: 'pro', planExpiresAt: '2027-01-31', note: '  Pizzería, 5 sucursales '
    });
    expect(business.status).toBe('setup');
    expect(business.name).toBe(PLACEHOLDER_BUSINESS_NAME);
    expect(business.slug).toMatch(/^nuevo-[0-9a-f]{6}$/);
    expect(business.type).toBe('otro');
    expect(business.plan).toBe('pro');
    expect(business.planExpiresAt).toBe(new Date('2027-01-31').toISOString());
    expect(invite.kind).toBe('invite');
    expect(Date.parse(invite.expiresAt) - now()).toBe(INVITE_TTL_HOURS * HOUR);
    expect((await repo.getProgram(business.id)).name).toBe('Tarjeta de sellos');
    expect((await repo.getAdminBusiness(business.id))?.note).toBe('Pizzería, 5 sucursales');

    const owner = (await repo.listStaff(business.id)).find((s) => s.id === ownerId)!;
    expect(owner).toMatchObject({ role: 'owner', email: 'duena@pizzeria.ec', invitePending: true, hasPin: false, active: true });
    expect(await repo.verifyCredentials('duena@pizzeria.ec', PASSWORD)).toBeNull();   // todavía sin contraseña

    const info = await repo.peekAccessToken(invite.token);
    expect(info).toMatchObject({
      kind: 'invite', staffId: ownerId, businessId: business.id, email: 'duena@pizzeria.ec',
      businessName: PLACEHOLDER_BUSINESS_NAME, businessStatus: 'setup', expiresAt: invite.expiresAt
    });

    expect(await repo.consumeAccessToken(invite.token, PASSWORD, '  Ana Pérez ')).toEqual({ businessId: business.id, staffId: ownerId });
    expect(await repo.peekAccessToken(invite.token)).toBeNull();
    await expect(repo.consumeAccessToken(invite.token, PASSWORD)).rejects.toThrow(LINK_INVALID);

    expect(await repo.verifyCredentials('DUENA@pizzeria.ec', PASSWORD)).toEqual({ businessId: business.id, staffId: ownerId });
    const after = (await repo.listStaff(business.id)).find((s) => s.id === ownerId)!;
    expect(after.name).toBe('Ana Pérez');
    expect(after.invitePending).toBe(false);
    expect(JSON.stringify(after)).not.toMatch(/hash|scrypt/i);
  });

  it('valida correo, plan, fecha y correo repetido', async () => {
    const { repo } = setup();
    await expect(repo.createBusinessAccess({ ownerEmail: 'no-es-correo', plan: 'gratis' })).rejects.toThrow('Escribe un correo válido.');
    await expect(repo.createBusinessAccess({ ownerEmail: 'a@b.ec', plan: 'oro' as never })).rejects.toThrow('Elige un plan válido.');
    await expect(repo.createBusinessAccess({ ownerEmail: 'a@b.ec', plan: 'gratis', planExpiresAt: 'mañana' })).rejects.toThrow('La fecha de vencimiento no es válida.');
    await repo.createBusinessAccess({ ownerEmail: 'a@b.ec', plan: 'gratis' });
    await expect(repo.createBusinessAccess({ ownerEmail: 'A@B.EC', plan: 'gratis' })).rejects.toThrow(EMAIL_TAKEN);
    expect(await repo.listBusinesses()).toHaveLength(1);
  });

  it('contraseña débil o nombre inválido no gastan el enlace', async () => {
    const { repo } = setup();
    const { invite } = await repo.createBusinessAccess({ ownerEmail: 'debil@b.ec', plan: 'gratis' });
    await expect(repo.consumeAccessToken(invite.token, 'corta')).rejects.toThrow(/10 caracteres/);
    await expect(repo.consumeAccessToken(invite.token, PASSWORD, 'A')).rejects.toThrow('Escribe un nombre de al menos 2 letras.');
    expect(await repo.peekAccessToken(invite.token)).not.toBeNull();
    await expect(repo.consumeAccessToken('basura', PASSWORD)).rejects.toThrow(LINK_INVALID);
  });
});

describe('enlaces de un solo uso', () => {
  it('vence a las 72 h (invitación) y a los 60 min (restablecer)', async () => {
    const { repo, advance } = setup();
    const { ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: 'vence@b.ec', plan: 'gratis' });
    advance(INVITE_TTL_HOURS * HOUR - 1);
    expect(await repo.peekAccessToken(invite.token)).not.toBeNull();
    advance(1);
    expect(await repo.peekAccessToken(invite.token)).toBeNull();
    await expect(repo.consumeAccessToken(invite.token, PASSWORD)).rejects.toThrow(LINK_INVALID);

    const reset = await repo.issueAccessToken(ownerId, 'reset');
    expect((await repo.peekAccessToken(reset.token))?.kind).toBe('reset');
    advance(RESET_TTL_MINUTES * MIN);
    expect(await repo.peekAccessToken(reset.token)).toBeNull();
  });

  it('reemitir invalida el anterior del mismo tipo', async () => {
    const { repo } = setup();
    const { ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: 'reemite@b.ec', plan: 'gratis' });
    const reset = await repo.issueAccessToken(ownerId, 'reset');
    const again = await repo.issueAccessToken(ownerId, 'invite');
    expect(await repo.peekAccessToken(invite.token)).toBeNull();
    expect(await repo.peekAccessToken(again.token)).not.toBeNull();
    expect(await repo.peekAccessToken(reset.token)).not.toBeNull();   // otro tipo: sigue vigente
    await expect(repo.consumeAccessToken(invite.token, PASSWORD)).rejects.toThrow(LINK_INVALID);
    await repo.consumeAccessToken(again.token, PASSWORD);
  });

  it('el enlace de restablecer cambia la contraseña y desbloquea la cuenta', async () => {
    const { repo } = setup();
    const { ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: 'olvido@b.ec', plan: 'gratis' });
    await repo.consumeAccessToken(invite.token, PASSWORD);
    for (let i = 0; i < 5; i++) await repo.verifyCredentials('olvido@b.ec', 'mala-contrasena');
    expect(await repo.isLoginLocked('olvido@b.ec')).toBe(true);
    const reset = await repo.issueAccessToken(ownerId, 'reset');
    await repo.consumeAccessToken(reset.token, 'Otra-Contrasena-9');
    expect(await repo.isLoginLocked('olvido@b.ec')).toBe(false);
    expect(await repo.verifyCredentials('olvido@b.ec', 'Otra-Contrasena-9')).not.toBeNull();
    expect(await repo.verifyCredentials('olvido@b.ec', PASSWORD)).toBeNull();
  });

  it('no emite para personas desactivadas o sin correo, y el enlace muere si la persona se desactiva', async () => {
    const { repo } = setup();
    const { business, ownerId } = await repo.createBusinessAccess({ ownerEmail: 'jefa@b.ec', plan: 'gratis' });
    const cajero = await repo.upsertStaff(business.id, { name: 'Luis', role: 'cashier' });
    await expect(repo.issueAccessToken(cajero.id, 'invite')).rejects.toThrow('Esa persona no tiene correo de acceso.');
    await repo.setStaffEmail(business.id, cajero.id, 'luis@b.ec', ownerId);
    const t = await repo.issueAccessToken(cajero.id, 'invite');
    await repo.upsertStaff(business.id, { id: cajero.id, name: 'Luis', role: 'cashier', active: false });
    expect(await repo.peekAccessToken(t.token)).toBeNull();
    await expect(repo.issueAccessToken(cajero.id, 'invite')).rejects.toThrow('Esa persona está desactivada.');
    await expect(repo.issueAccessToken('emp_nadie', 'invite')).rejects.toThrow('No encontramos a esa persona del equipo.');
  });
});

describe('setStaffEmail y findStaffByEmail', () => {
  it('rechaza correos repetidos en toda la plataforma y al cambiar invalida los enlaces', async () => {
    const { repo } = setup();
    const a = await repo.createBusinessAccess({ ownerEmail: 'uno@a.ec', plan: 'gratis' });
    const b = await repo.createBusinessAccess({ ownerEmail: 'dos@b.ec', plan: 'gratis' });
    await expect(repo.setStaffEmail(b.business.id, b.ownerId, ' UNO@a.ec ', b.ownerId)).rejects.toThrow(EMAIL_TAKEN);
    await expect(repo.setStaffEmail(b.business.id, b.ownerId, 'mal', b.ownerId)).rejects.toThrow('Escribe un correo válido.');
    await expect(repo.setStaffEmail(a.business.id, b.ownerId, 'tres@b.ec')).rejects.toThrow('No encontramos a esa persona del equipo.');

    // El mismo correo que ya tiene no cuenta como repetido ni invalida la invitación.
    await repo.setStaffEmail(b.business.id, b.ownerId, 'dos@b.ec');
    expect(await repo.peekAccessToken(b.invite.token)).not.toBeNull();

    const s = await repo.setStaffEmail(b.business.id, b.ownerId, 'Tres@B.ec', b.ownerId);
    expect(s.email).toBe('tres@b.ec');
    expect(await repo.peekAccessToken(b.invite.token)).toBeNull();
    expect((await repo.findStaffByEmail(' TRES@b.ec'))?.id).toBe(b.ownerId);
    expect(await repo.findStaffByEmail('dos@b.ec')).toBeNull();
  });
});

describe('asistente de bienvenida', () => {
  it('saveBusinessSetup regenera el slug y la plantilla solo mientras está en setup', async () => {
    const { repo } = setup();
    const first = await activeBusiness(repo, 'luna1@a.ec', 'Café Luna');
    expect(first.business.slug).toBe('cafe-luna');

    const { business, ownerId } = await repo.createBusinessAccess({ ownerEmail: 'luna2@a.ec', plan: 'gratis' });
    await repo.uploadBusinessImage(business.id, 'logo', { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0]), contentType: 'image/png' });
    const saved = await repo.saveBusinessSetup(business.id, { name: 'Café Luna', type: 'gimnasio' }, ownerId);
    expect(saved.slug).toBe('cafe-luna-2');
    const prog = await repo.getProgram(business.id);
    expect(prog).toMatchObject({ name: 'Constancia', stampsRequired: 12, requireAmount: false, logoText: 'CL' });
    expect(prog.logoUrl).toMatch(/^data:image\/png;base64,/);   // la plantilla no borra el logo
    expect((await repo.saveBusinessSetup(business.id, { name: 'Gym Norte', type: 'gimnasio' })).slug).toBe('gym-norte');

    // Activo: el slug ya no cambia (el QR impreso depende de él) ni se reaplica la plantilla.
    await repo.updateProgram(first.business.id, { stampsRequired: 6 });
    const renamed = await repo.saveBusinessSetup(first.business.id, { name: 'Café Luna Nueva', type: 'panaderia', city: ' Cuenca ' });
    expect(renamed).toMatchObject({ slug: 'cafe-luna', name: 'Café Luna Nueva', type: 'panaderia', city: 'Cuenca' });
    expect((await repo.getProgram(first.business.id)).stampsRequired).toBe(6);
  });

  it('valida el nombre', async () => {
    const { repo } = setup();
    const { business } = await repo.createBusinessAccess({ ownerEmail: 'nombre@a.ec', plan: 'gratis' });
    await expect(repo.saveBusinessSetup(business.id, { name: ' x ', type: 'otro' })).rejects.toThrow('Escribe el nombre de tu negocio.');
    await expect(repo.saveBusinessSetup(business.id, { name: 'negocio NUEVO', type: 'otro' })).rejects.toThrow('Escribe el nombre real de tu negocio.');
    await expect(repo.saveBusinessSetup(business.id, { name: 'a'.repeat(81), type: 'otro' })).rejects.toThrow(/demasiado largo/);
  });

  it('completeBusinessSetup exige nombre real y una sucursal activa', async () => {
    const { repo } = setup();
    const { business, ownerId } = await repo.createBusinessAccess({ ownerEmail: 'listo@a.ec', plan: 'gratis' });
    await expect(repo.completeBusinessSetup(business.id, ownerId)).rejects.toThrow('Primero escribe el nombre de tu negocio.');
    await repo.saveBusinessSetup(business.id, { name: 'Flores Ana', type: 'floristeria' }, ownerId);
    await expect(repo.completeBusinessSetup(business.id, ownerId)).rejects.toThrow('Agrega al menos una sucursal.');
    const loc = await repo.upsertLocation(business.id, { name: 'Centro', active: false });
    await expect(repo.completeBusinessSetup(business.id, ownerId)).rejects.toThrow('Agrega al menos una sucursal.');
    await repo.upsertLocation(business.id, { id: loc.id, name: 'Centro', active: true });
    const done = await repo.completeBusinessSetup(business.id, ownerId);
    expect(done.status).toBe('active');
    expect(done.setupCompletedAt).toBeDefined();
  });

  it('uploadBusinessImage valida tipo, tamaño y firma', async () => {
    const { repo } = setup();
    const { business } = await repo.createBusinessAccess({ ownerEmail: 'img@a.ec', plan: 'gratis' });
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    await expect(repo.uploadBusinessImage(business.id, 'cover', { bytes: jpg, contentType: 'image/gif' })).rejects.toThrow('La imagen debe ser PNG, JPG o WEBP.');
    await expect(repo.uploadBusinessImage(business.id, 'cover', { bytes: jpg, contentType: 'image/png' })).rejects.toThrow('El archivo no parece una imagen válida.');
    await expect(repo.uploadBusinessImage(business.id, 'cover', { bytes: new Uint8Array(2 * 1024 * 1024 + 1), contentType: 'image/jpeg' })).rejects.toThrow(/2 MB/);
    const url = await repo.uploadBusinessImage(business.id, 'cover', { bytes: jpg, contentType: 'image/jpeg' });
    expect((await repo.getProgram(business.id)).coverUrl).toBe(url);
  });
});

describe('setBusinessStatus', () => {
  it('suspender y reactivar un negocio activo lo deja activo; sin sellos mientras está suspendido', async () => {
    const { repo } = setup();
    const { business, ownerId } = await activeBusiness(repo, 'activo@a.ec', 'Barbería Max');
    const customer = await repo.registerVerifiedCustomer(business.id, { name: 'Carla', email: 'carla@c.ec', birthday: { d: 3, m: 4 } });
    const made = await repo.createStampCode(business.id, { staffId: ownerId, ticket: 'T-1', amountCents: 1000, seats: 1 });
    if (!made.ok) throw new Error(made.error);

    const s = await repo.setBusinessStatus(business.id, 'suspended');
    expect(s.status).toBe('suspended');
    expect(s.suspendedAt).toBeDefined();
    expect(await repo.claimStampCode(business.id, made.code.code, customer.id)).toEqual({ ok: false, error: 'Este negocio no está recibiendo sellos por ahora.' });
    await expect(repo.completeBusinessSetup(business.id, ownerId)).rejects.toThrow('Tu cuenta está suspendida. Escríbenos por WhatsApp.');

    const r = await repo.setBusinessStatus(business.id, 'active');
    expect(r.status).toBe('active');
    expect(r.suspendedAt).toBeUndefined();
    expect((await repo.claimStampCode(business.id, made.code.code, customer.id)).ok).toBe(true);
  });

  it('reactivar un negocio que nunca terminó el asistente lo devuelve a setup', async () => {
    const { repo } = setup();
    const { business } = await repo.createBusinessAccess({ ownerEmail: 'nunca@a.ec', plan: 'gratis' });
    await repo.setBusinessStatus(business.id, 'suspended');
    expect((await repo.setBusinessStatus(business.id, 'active')).status).toBe('setup');
  });

  it('un negocio anterior al MVP (sin estado) vuelve a active al reactivarlo', async () => {
    const { repo } = setup();
    const { business } = await repo.createBusiness({ name: 'Panadería Vieja', type: 'panaderia', ownerName: 'Rosa', ownerPin: '1234' });
    expect(business.status).toBeUndefined();
    await repo.setBusinessStatus(business.id, 'suspended');
    expect((await repo.setBusinessStatus(business.id, 'active')).status).toBe('active');
  });

  it('un negocio en setup no recibe sellos', async () => {
    const { repo } = setup();
    const { business, ownerId, invite } = await repo.createBusinessAccess({ ownerEmail: 'setup@a.ec', plan: 'gratis' });
    await repo.consumeAccessToken(invite.token, PASSWORD);
    const c = await repo.registerCustomer(business.id, { name: 'Prueba', contact: 'p@p.ec', contactKind: 'email' });
    const made = await repo.createStampCode(business.id, { staffId: ownerId, ticket: 'S-1', amountCents: 1000, seats: 1 });
    if (!made.ok) throw new Error(made.error);
    expect(await repo.claimStampCode(business.id, made.code.code, c.id)).toEqual({ ok: false, error: 'Este negocio no está recibiendo sellos por ahora.' });
  });
});

describe('códigos de verificación de correo', () => {
  it('máximo 5 por correo por hora', async () => {
    const { repo, advance } = setup();
    for (let i = 0; i < OTP_MAX_PER_HOUR; i++) expect((await repo.requestEmailOtp('limite@c.ec')).ok).toBe(true);
    expect(await repo.requestEmailOtp('LIMITE@c.ec')).toEqual({ ok: false, error: 'Pediste demasiados códigos. Espera un rato e inténtalo de nuevo.' });
    expect((await repo.requestEmailOtp('otro@c.ec')).ok).toBe(true);
    advance(HOUR);
    expect((await repo.requestEmailOtp('limite@c.ec')).ok).toBe(true);
    expect(await repo.requestEmailOtp('mal')).toEqual({ ok: false, error: 'Escribe un correo válido.' });
  });

  it('el código correcto sirve una sola vez y el nuevo reemplaza al anterior', async () => {
    const { repo } = setup();
    const r1 = await repo.requestEmailOtp('uso@c.ec');
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.code).toMatch(/^\d{6}$/);
    const r2 = await repo.requestEmailOtp('uso@c.ec');
    if (!r2.ok) throw new Error(r2.error);
    if (r1.code !== r2.code) expect(await repo.verifyEmailOtp('uso@c.ec', r1.code)).toBe(false);
    expect(await repo.verifyEmailOtp(' USO@c.ec ', r2.code)).toBe(true);
    expect(await repo.verifyEmailOtp('uso@c.ec', r2.code)).toBe(false);
  });

  it('5 intentos fallidos inutilizan el código', async () => {
    const { repo } = setup();
    const r = await repo.requestEmailOtp('intentos@c.ec');
    if (!r.ok) throw new Error(r.error);
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) expect(await repo.verifyEmailOtp('intentos@c.ec', otherCode(r.code))).toBe(false);
    expect(await repo.verifyEmailOtp('intentos@c.ec', 'abc')).toBe(false);   // basura: no cuenta como intento
    expect(await repo.verifyEmailOtp('intentos@c.ec', r.code)).toBe(true);

    const r2 = await repo.requestEmailOtp('intentos@c.ec');
    if (!r2.ok) throw new Error(r2.error);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) expect(await repo.verifyEmailOtp('intentos@c.ec', otherCode(r2.code))).toBe(false);
    expect(await repo.verifyEmailOtp('intentos@c.ec', r2.code)).toBe(false);
  });

  it('vence a los 10 minutos', async () => {
    const { repo, advance } = setup();
    const r = await repo.requestEmailOtp('vence@c.ec');
    if (!r.ok) throw new Error(r.error);
    advance(OTP_TTL_MINUTES * MIN - 1);
    const r2 = await repo.requestEmailOtp('vence2@c.ec');
    if (!r2.ok) throw new Error(r2.error);
    expect(await repo.verifyEmailOtp('vence2@c.ec', r2.code)).toBe(true);
    advance(1);
    expect(await repo.verifyEmailOtp('vence@c.ec', r.code)).toBe(false);
  });

  it('el código de otro correo no sirve', async () => {
    const { repo } = setup();
    const a = await repo.requestEmailOtp('a@c.ec');
    const b = await repo.requestEmailOtp('b@c.ec');
    if (!a.ok || !b.ok) throw new Error('sin código');
    if (a.code !== b.code) expect(await repo.verifyEmailOtp('b@c.ec', a.code)).toBe(false);
    expect(await repo.verifyEmailOtp('c@c.ec', a.code)).toBe(false);
    expect(await repo.verifyEmailOtp('a@c.ec', a.code)).toBe(true);
  });
});

describe('clientes de la página pública', () => {
  it('registerVerifiedCustomer es idempotente y guarda verificación y año', async () => {
    const { repo, now } = setup();
    const { business } = await activeBusiness(repo, 'pub@a.ec', 'Café Sol');
    const c1 = await repo.registerVerifiedCustomer(business.id, { name: 'María', email: ' Maria@Correo.com ', birthday: { d: 9, m: 2 }, birthdayYear: 1990 });
    expect(c1).toMatchObject({ contact: 'maria@correo.com', contactKind: 'email', birthday: { d: 9, m: 2 }, birthdayYear: 1990, stamps: 0 });
    expect(c1.emailVerifiedAt).toBe(new Date(now()).toISOString());
    expect(c1.consentAt).toBe(c1.emailVerifiedAt);
    const c2 = await repo.registerVerifiedCustomer(business.id, { name: 'Otro nombre', email: 'maria@correo.com', birthday: { d: 1, m: 0 } });
    expect(c2.id).toBe(c1.id);
    expect(c2.name).toBe('María');
    expect((await repo.findCustomerByEmail(business.id, 'MARIA@correo.com'))?.id).toBe(c1.id);
    expect(await repo.listCustomers(business.id)).toHaveLength(1);

    await expect(repo.registerVerifiedCustomer(business.id, { name: 'X', email: 'x@c.ec', birthday: { d: 1, m: 0 } })).rejects.toThrow('Escribe un nombre de al menos 2 letras.');
    await expect(repo.registerVerifiedCustomer(business.id, { name: 'Xavi', email: 'x@c.ec', birthday: { d: 1, m: 12 } })).rejects.toThrow('El cumpleaños no es válido.');
    await expect(repo.registerVerifiedCustomer(business.id, { name: 'Xavi', email: 'x@c.ec', birthday: { d: 1, m: 0 }, birthdayYear: 2025 })).rejects.toThrow('El año de nacimiento no es válido.');
  });

  it('marca como verificado a un cliente que el negocio registró antes', async () => {
    const { repo } = setup();
    const { business } = await activeBusiness(repo, 'prev@a.ec', 'Café Previo');
    const before = await repo.registerCustomer(business.id, { name: 'Pedro', contact: 'pedro@c.ec', contactKind: 'email' });
    expect(before.emailVerifiedAt).toBeUndefined();
    const after = await repo.registerVerifiedCustomer(business.id, { name: 'Pedro', email: 'pedro@c.ec', birthday: { d: 1, m: 1 } });
    expect(after.id).toBe(before.id);
    expect(after.emailVerifiedAt).toBeDefined();
  });

  it('rechaza negocios en setup o suspendidos', async () => {
    const { repo } = setup();
    const msg = 'Este negocio no está recibiendo clientes nuevos por ahora.';
    const { business: enSetup } = await repo.createBusinessAccess({ ownerEmail: 'rs@a.ec', plan: 'gratis' });
    await expect(repo.registerVerifiedCustomer(enSetup.id, { name: 'Ana', email: 'ana@c.ec', birthday: { d: 1, m: 1 } })).rejects.toThrow(msg);
    const { business } = await activeBusiness(repo, 'rs2@a.ec', 'Spa Zen');
    await repo.setBusinessStatus(business.id, 'suspended');
    await expect(repo.registerVerifiedCustomer(business.id, { name: 'Ana', email: 'ana@c.ec', birthday: { d: 1, m: 1 } })).rejects.toThrow(msg);
  });

  it('listCustomerCards excluye negocios en setup e incluye los suspendidos (congelados)', async () => {
    const { repo, advance } = setup();
    const a = await activeBusiness(repo, 'cards1@a.ec', 'Café Uno');
    const b = await activeBusiness(repo, 'cards2@a.ec', 'Café Dos');
    const { business: enSetup } = await repo.createBusinessAccess({ ownerEmail: 'cards3@a.ec', plan: 'gratis' });
    const ca = await repo.registerVerifiedCustomer(a.business.id, { name: 'Lucía', email: 'lucia@c.ec', birthday: { d: 5, m: 5 } });
    advance(MIN);
    await repo.registerVerifiedCustomer(b.business.id, { name: 'Lucía', email: 'lucia@c.ec', birthday: { d: 5, m: 5 } });
    await repo.registerCustomer(enSetup.id, { name: 'Lucía', contact: 'lucia@c.ec', contactKind: 'email' });
    await repo.setBusinessStatus(b.business.id, 'suspended');

    advance(MIN);
    const made = await repo.createStampCode(a.business.id, { staffId: a.ownerId, ticket: 'C-1', amountCents: 2000, seats: 1 });
    if (!made.ok) throw new Error(made.error);
    expect((await repo.claimStampCode(a.business.id, made.code.code, ca.id)).ok).toBe(true);

    const cards = await repo.listCustomerCards(' LUCIA@c.ec ');
    expect(cards.map((c) => c.business.id)).toEqual([a.business.id, b.business.id]);   // la de visita más reciente primero
    expect(cards[1].business.status).toBe('suspended');
    expect(cards[0].customer.stamps).toBe(1);
    expect(cards[0].recent).toEqual([{ at: cards[0].customer.lastVisitAt, kind: 'stamp' }]);
    expect(cards[0].program.businessId).toBe(a.business.id);
    expect(await repo.listCustomerCards('')).toEqual([]);

    expect((await repo.getCustomerCard(a.business.id, ca.id))?.customer.id).toBe(ca.id);
    expect(await repo.getCustomerCard(b.business.id, ca.id)).toBeNull();
    expect((await repo.getBusinessBySlug('cafe-uno'))?.id).toBe(a.business.id);
    expect(await repo.getBusinessBySlug('no-existe')).toBeNull();
  });
});

describe('cuentas de administrador', () => {
  const ADMIN = 'administrador@stampa.com';

  it('verifica, registra el último acceso y cambia la contraseña', async () => {
    const { repo } = setup();
    const created = await repo.upsertAdmin(' Administrador@Stampa.com ', PASSWORD);
    expect(created.email).toBe(ADMIN);
    expect(await repo.verifyAdminCredentials(ADMIN, 'mala-contrasena')).toBeNull();
    expect(await repo.verifyAdminCredentials('nadie@stampa.com', PASSWORD)).toBeNull();
    const ok = await repo.verifyAdminCredentials('ADMINISTRADOR@stampa.com', PASSWORD);
    expect(ok).toEqual({ adminId: created.id });
    const acc = await repo.getAdmin(created.id);
    expect(acc?.lastLoginAt).toBeDefined();
    expect(JSON.stringify(acc)).not.toMatch(/hash|scrypt/i);
    expect(await repo.getAdmin('adm_nadie')).toBeNull();

    await expect(repo.changeAdminPassword(created.id, 'no-es-la-actual', 'Nueva-Contrasena-1')).rejects.toThrow('La contraseña actual no es correcta.');
    await expect(repo.changeAdminPassword(created.id, PASSWORD, PASSWORD)).rejects.toThrow('La contraseña nueva debe ser distinta de la actual.');
    await expect(repo.changeAdminPassword(created.id, PASSWORD, 'corta')).rejects.toThrow(/10 caracteres/);
    await expect(repo.changeAdminPassword('adm_nadie', PASSWORD, 'Nueva-Contrasena-1')).rejects.toThrow('No encontramos esa cuenta.');
    await repo.changeAdminPassword(created.id, PASSWORD, 'Nueva-Contrasena-1');
    expect(await repo.verifyAdminCredentials(ADMIN, PASSWORD)).toBeNull();
    expect(await repo.verifyAdminCredentials(ADMIN, 'Nueva-Contrasena-1')).toEqual({ adminId: created.id });

    // upsertAdmin con el mismo correo reemplaza la contraseña (no crea otra cuenta).
    const same = await repo.upsertAdmin(ADMIN, 'Tercera-Contrasena-3');
    expect(same.id).toBe(created.id);
    expect(await repo.verifyAdminCredentials(ADMIN, 'Tercera-Contrasena-3')).toEqual({ adminId: created.id });
  });

  it('5 fallos seguidos bloquean 15 minutos (también para correos que no existen)', async () => {
    const { repo, advance } = setup();
    const { id } = await repo.upsertAdmin(ADMIN, PASSWORD);
    for (let i = 0; i < 5; i++) expect(await repo.verifyAdminCredentials(ADMIN, `mala-${i}-contrasena`)).toBeNull();
    expect(await repo.isAdminLoginLocked(ADMIN)).toBe(true);
    expect(await repo.verifyAdminCredentials(ADMIN, PASSWORD)).toBeNull();   // correcta, pero bloqueada
    for (let i = 0; i < 5; i++) await repo.verifyAdminCredentials('fantasma@stampa.com', PASSWORD);
    expect(await repo.isAdminLoginLocked('fantasma@stampa.com')).toBe(true);
    advance(15 * MIN);
    expect(await repo.isAdminLoginLocked(ADMIN)).toBe(false);
    expect(await repo.verifyAdminCredentials(ADMIN, PASSWORD)).toEqual({ adminId: id });
    // El equipo de los negocios no entra al panel de administrador.
    expect(await repo.verifyAdminCredentials('pub@a.ec', PASSWORD)).toBeNull();
  });

  it('upsertAdmin valida correo y contraseña', async () => {
    const { repo } = setup();
    await expect(repo.upsertAdmin('mal', PASSWORD)).rejects.toThrow('Escribe un correo válido.');
    await expect(repo.upsertAdmin(ADMIN, 'corta')).rejects.toThrow(/10 caracteres/);
  });
});

describe('panel de administrador: resumen y lista de negocios', () => {
  it('getPlatformSummary y listAdminBusinesses', async () => {
    const { repo, now, advance } = setup();
    const activo = await activeBusiness(repo, 'res1@a.ec', 'Café Activo');
    advance(MIN);
    const vence = await repo.createBusinessAccess({ ownerEmail: 'res2@a.ec', plan: 'negocio', planExpiresAt: new Date(now() + 3 * 24 * HOUR).toISOString(), note: 'Paga por WhatsApp' });
    advance(MIN);
    await repo.createBusinessAccess({ ownerEmail: 'res3@a.ec', plan: 'gratis', planExpiresAt: new Date(now() - 24 * HOUR).toISOString() });
    advance(MIN);
    const susp = await activeBusiness(repo, 'res4@a.ec', 'Spa Pausa');
    await repo.setBusinessStatus(susp.business.id, 'suspended');
    await repo.updateBusinessPlan(susp.business.id, 'pro', new Date(now() - 24 * HOUR).toISOString());   // vencido pero suspendido: no cuenta

    const cust = await repo.registerVerifiedCustomer(activo.business.id, { name: 'Rocío', email: 'rocio@c.ec', birthday: { d: 2, m: 2 } });
    const made = await repo.createStampCode(activo.business.id, { staffId: activo.ownerId, ticket: 'R-1', amountCents: 1500, seats: 1 });
    if (!made.ok) throw new Error(made.error);
    await repo.claimStampCode(activo.business.id, made.code.code, cust.id);

    const sum = await repo.getPlatformSummary();
    expect(sum.businesses).toEqual({ total: 4, active: 1, setup: 2, suspended: 1, expiringSoon: 1, expired: 1 });
    expect(sum).toMatchObject({ customers: 1, stamps30d: 1, stampsTotal: 1, redemptions30d: 0, redemptionsTotal: 0 });

    const rows = await repo.listAdminBusinesses();
    expect(rows.map((r) => r.business.id)).toEqual([susp.business.id, rows[1].business.id, vence.business.id, activo.business.id]);
    const rowVence = rows.find((r) => r.business.id === vence.business.id)!;
    expect(rowVence.note).toBe('Paga por WhatsApp');
    expect(rowVence.owner).toMatchObject({ staffId: vence.ownerId, email: 'res2@a.ec', invitePending: true });
    const rowActivo = rows.find((r) => r.business.id === activo.business.id)!;
    expect(rowActivo.owner?.invitePending).toBe(false);
    expect(rowActivo.stats).toMatchObject({ customers: 1, stamps30d: 1, redemptions30d: 0 });
    expect(rowActivo.stats.lastActivityAt).toBe(new Date(now()).toISOString());

    // Plan: cambia y quita el vencimiento; la nota vacía la borra y undefined no la toca.
    const upd = await repo.updateBusinessPlan(vence.business.id, 'pro', null);
    expect(upd).toMatchObject({ plan: 'pro', planExpiresAt: undefined });
    expect((await repo.getAdminBusiness(vence.business.id))?.note).toBe('Paga por WhatsApp');
    await repo.updateBusinessPlan(vence.business.id, 'pro', null, '  ');
    expect((await repo.getAdminBusiness(vence.business.id))?.note).toBeUndefined();
    await expect(repo.updateBusinessPlan(vence.business.id, 'oro' as never, null)).rejects.toThrow('Elige un plan válido.');
    expect(await repo.getAdminBusiness('biz_nadie')).toBeNull();
  });
});
