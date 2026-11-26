import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import type { CustomerCard } from '../../contracts';
import { createMemoryRepo } from '../../repo/memory';
import { appleAuthToken, appleSerial, checkAppleAuth, parseAppleSerial } from './auth';
import { appleWalletConfig } from './config';
import { couponPassJson, giftPassJson, stampPassJson, FRESH_COUPON_MS } from './passes';
import { buildApplePass, contentDate, resolveAppleSerial } from './service';
import { makeTestSigner } from './testing';
import { deviceLog, latestPass, registerDevice, serialsForDevice, unregisterDevice } from './webservice';
import { notifyApple, syncApplePasses } from './index';

const NOW = Date.parse('2026-11-26T15:00:00Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const signer = makeTestSigner();
const b64 = (s: string) => Buffer.from(s).toString('base64');
const ENV = {
  APPLE_PASS_TYPE_ID: 'pass.app.stampa.prueba',
  APPLE_TEAM_ID: 'AB12CD34EF',
  APPLE_PASS_CERT_PEM_BASE64: b64(signer.certPem),
  APPLE_PASS_KEY_PEM_BASE64: b64(signer.keyPem),
  APPLE_WWDR_PEM_BASE64: b64(signer.wwdrPem),
  APPLE_PASS_AUTH_SECRET: 's'.repeat(40),
  NEXT_PUBLIC_APP_URL: 'https://stampaecu.app'
};
const saved: Record<string, string | undefined> = {};
const g = globalThis as unknown as { __stampaRepo?: unknown };
let prevRepo: unknown;

let repo: ReturnType<typeof createMemoryRepo>;
let card: CustomerCard;
let couponId: string;
let giftId: string;
let ownerId: string;

beforeAll(async () => {
  for (const [k, v] of Object.entries(ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  prevRepo = g.__stampaRepo;
  repo = createMemoryRepo({ seed: false, clock: () => NOW });
  g.__stampaRepo = repo;
  const { business: b, ownerId: owner } = await repo.createBusinessAccess({ ownerEmail: 'apple@prueba.ec', plan: 'pro' });
  ownerId = owner;
  const c = await repo.registerCustomer(b.id, { name: 'Ana Mora', contact: 'ana@c.ec', contactKind: 'email' });
  const o = await repo.createOffer(b.id, { title: '2x1 en capuchinos', description: 'Lleva dos y paga uno.', terms: 'Solo de lunes a jueves.', startsAt: iso(NOW - DAY), endsAt: iso(NOW + 7 * DAY) }, owner);
  await repo.sendOffer(b.id, o.id, owner);
  const gift = await repo.issueGiftCard(b.id, { amountCents: 2550, staffId: owner, customerId: c.id });
  giftId = gift.giftCard.id;
  const loc = (await repo.listLocations(b.id))[0] ?? await repo.upsertLocation(b.id, { name: 'Centro', active: true });
  await repo.setLocationCoords(b.id, loc.id, { latitude: -0.18, longitude: -78.48 }, owner);
  card = (await repo.getCustomerCard(b.id, c.id))!;
  couponId = card.offers[0].id;
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  g.__stampaRepo = prevRepo;
});

const cfg = () => appleWalletConfig()!;

describe('Apple Wallet: serial y token', () => {
  it('serial con tipo, negocio e id; se lee de vuelta', () => {
    const s = appleSerial('coupon', 'biz_1', 'cof_2');
    expect(s).toBe('c.biz_1.cof_2');
    expect(parseAppleSerial(s)).toEqual({ kind: 'coupon', businessId: 'biz_1', id: 'cof_2' });
    expect(parseAppleSerial('x.biz_1.cof_2')).toBeNull();
    expect(parseAppleSerial('s.biz_1')).toBeNull();
    expect(() => appleSerial('stamp', 'biz.1', 'c')).toThrow();
  });

  it('token HMAC de 16+ caracteres, distinto por serial, y verificación estricta', () => {
    const t = appleAuthToken('s.biz_1.cli_1', 'x'.repeat(40));
    expect(t.length).toBeGreaterThanOrEqual(16);
    expect(t).not.toBe(appleAuthToken('s.biz_1.cli_2', 'x'.repeat(40)));
    expect(checkAppleAuth(`ApplePass ${t}`, 's.biz_1.cli_1', 'x'.repeat(40))).toBe(true);
    expect(checkAppleAuth(`ApplePass ${t}`, 's.biz_1.cli_2', 'x'.repeat(40))).toBe(false);
    expect(checkAppleAuth(`Bearer ${t}`, 's.biz_1.cli_1', 'x'.repeat(40))).toBe(false);
    expect(checkAppleAuth(null, 's.biz_1.cli_1', 'x'.repeat(40))).toBe(false);
  });
});

describe('Apple Wallet: pass.json', () => {
  it('sellos: storeCard con progreso, próximo premio, cupón nuevo, ubicaciones sin el nombre y servicio web', () => {
    const p = stampPassJson(card, cfg(), new Date(NOW)) as Record<string, any>;
    expect(p).toMatchObject({
      formatVersion: 1, passTypeIdentifier: 'pass.app.stampa.prueba', teamIdentifier: 'AB12CD34EF',
      serialNumber: `s.${card.business.id}.${card.customer.id}`, webServiceURL: 'https://stampaecu.app/api/wallet', maxDistance: 100
    });
    expect(p.backgroundColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(p.authenticationToken).toBe(appleAuthToken(p.serialNumber, ENV.APPLE_PASS_AUTH_SECRET));
    expect(p.locations).toEqual([{ latitude: -0.18, longitude: -78.48, relevantText: 'Estás cerca. ¡Suma tu sello!' }]);
    expect(p.barcodes[0]).toMatchObject({ format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' });
    expect(p.storeCard.headerFields[0]).toMatchObject({ label: 'SELLOS', value: `0 de ${card.program.stampsRequired}` });
    expect(p.storeCard.primaryFields[0].changeMessage).toBe('%@');
    expect(p.storeCard.secondaryFields[0]).toMatchObject({ label: 'PRÓXIMO PREMIO' });
    expect(p.storeCard.auxiliaryFields[0]).toEqual({ key: 'coupon', label: 'CUPÓN', value: '2x1 en capuchinos', changeMessage: 'Nuevo cupón: %@' });
    expect(p.storeCard.backFields.map((f: { key: string }) => f.key)).toContain('coupons');
  });

  it('el campo del cupón deja de avisar cuando el cupón ya no es nuevo', () => {
    const later = new Date(Date.parse(card.offers[0].createdAt) + FRESH_COUPON_MS + 1000);
    const p = stampPassJson(card, cfg(), later) as Record<string, any>;
    expect(p.storeCard.auxiliaryFields[0].changeMessage).toBeUndefined();
    const none = stampPassJson({ ...card, offers: [] }, cfg(), new Date(NOW)) as Record<string, any>;
    expect(none.storeCard.auxiliaryFields[0].value).toBe('Sin cupones por ahora');
  });

  it('cupón: estilo coupon, QR fijo, vencimiento y anulado al usarse', () => {
    const co = card.offers[0];
    const p = couponPassJson(card, co, cfg(), new Date(NOW)) as Record<string, any>;
    expect(p.serialNumber).toBe(`c.${card.business.id}.${co.id}`);
    expect(p.barcodes[0].message).toBe(`STAMPA-CUPON:${co.id}`);
    expect(p.expirationDate).toBe(new Date(co.offer.endsAt).toISOString());
    expect(p.voided).toBeUndefined();
    expect(p.coupon.primaryFields[0].value).toBe('2x1 en capuchinos');
    expect(p.coupon.auxiliaryFields[0].value).toBe('Listo para usar');
    expect(p.locations[0].relevantText).toBe('Tienes un cupón para usar aquí');
    const used = couponPassJson(card, { ...co, redeemedAt: iso(NOW) }, cfg(), new Date(NOW)) as Record<string, any>;
    expect(used.voided).toBe(true);
    expect(used.coupon.auxiliaryFields[0].value).toBe('Usado');
  });

  it('gift card: saldo en formato de Ecuador con aviso, código legible y QR fijo', () => {
    const gift = card.giftCards[0];
    const p = giftPassJson(card, gift, cfg(), new Date(NOW)) as Record<string, any>;
    expect(p.serialNumber).toBe(`g.${card.business.id}.${gift.id}`);
    expect(p.storeCard.primaryFields[0]).toMatchObject({ value: '$25,50', changeMessage: 'Tu saldo ahora es %@' });
    expect(p.barcodes[0].message).toBe(`STAMPA-GIFT:${gift.code}`);
    expect(p.barcodes[0].altText).toMatch(/^[A-Z0-9]{4} [A-Z0-9]{4} [A-Z0-9]{4}$/);
    expect((giftPassJson(card, { ...gift, status: 'void', balanceCents: 0 }, cfg()) as Record<string, any>).voided).toBe(true);
  });
});

/** Lee pass.json de un .pkpass (zip). */
function passJsonOf(body: Buffer): Record<string, any> {
  const name = Buffer.from('pass.json');
  let p = body.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  while (p >= 0) {
    const nlen = body.readUInt16LE(p + 26);
    if (body.subarray(p + 30, p + 30 + nlen).equals(name)) {
      const start = p + 30 + nlen + body.readUInt16LE(p + 28);
      const data = body.subarray(start, start + body.readUInt32LE(p + 18));
      return JSON.parse((body.readUInt16LE(p + 8) === 8 ? inflateRawSync(data) : data).toString());
    }
    p = body.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), p + 4);
  }
  throw new Error('sin pass.json');
}

describe('Apple Wallet: servicio web', () => {
  const PT = ENV.APPLE_PASS_TYPE_ID;
  const DEVICE = 'device_abc123';
  const TOKEN = 'ab'.repeat(32);
  const auth = (serial: string) => ({ authorization: `ApplePass ${appleAuthToken(serial, ENV.APPLE_PASS_AUTH_SECRET)}` });
  const stamp = () => appleSerial('stamp', card.business.id, card.customer.id);

  it('resuelve cada tipo de serial desde la base', async () => {
    expect((await resolveAppleSerial(stamp()))?.kind).toBe('stamp');
    expect((await resolveAppleSerial(appleSerial('coupon', card.business.id, couponId)))?.kind).toBe('coupon');
    expect((await resolveAppleSerial(appleSerial('gift', card.business.id, giftId)))?.kind).toBe('gift');
    expect(await resolveAppleSerial(appleSerial('gift', card.business.id, 'gft_no'))).toBeNull();
    expect(await resolveAppleSerial('basura')).toBeNull();
  });

  it('registro: 401 sin token, 404 con otro Pass Type ID, 201 nuevo y 200 repetido', async () => {
    const body = JSON.stringify({ pushToken: TOKEN });
    const url = 'https://stampaecu.app/api/wallet/v1/x';
    expect((await registerDevice(new Request(url, { method: 'POST', body }), DEVICE, PT, stamp())).status).toBe(401);
    expect((await registerDevice(new Request(url, { method: 'POST', body, headers: auth(stamp()) }), DEVICE, 'pass.otro.id', stamp())).status).toBe(404);
    expect((await registerDevice(new Request(url, { method: 'POST', body: '{}', headers: auth(stamp()) }), DEVICE, PT, stamp())).status).toBe(400);
    expect((await registerDevice(new Request(url, { method: 'POST', body, headers: auth(stamp()) }), DEVICE, PT, stamp())).status).toBe(201);
    expect((await registerDevice(new Request(url, { method: 'POST', body, headers: auth(stamp()) }), DEVICE, PT, stamp())).status).toBe(200);
  });

  it('lista de seriales: JSON con lastUpdated y 204 si no hay cambios desde el tag', async () => {
    const r = await serialsForDevice(new Request('https://stampaecu.app/x'), DEVICE, PT);
    expect(r.status).toBe(200);
    const j = await r.json() as { serialNumbers: string[]; lastUpdated: string };
    expect(j.serialNumbers).toEqual([stamp()]);
    const r2 = await serialsForDevice(new Request(`https://stampaecu.app/x?passesUpdatedSince=${encodeURIComponent(j.lastUpdated)}`), DEVICE, PT);
    expect(r2.status).toBe(204);
    expect((await serialsForDevice(new Request('https://stampaecu.app/x'), 'otro_device', PT)).status).toBe(204);
  });

  it('pase más reciente: .pkpass con Last-Modified y 304 si no cambió', async () => {
    const url = 'https://stampaecu.app/x';
    expect((await latestPass(new Request(url), PT, stamp())).status).toBe(401);
    const r = await latestPass(new Request(url, { headers: auth(stamp()) }), PT, stamp(), new Date(NOW));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/vnd.apple.pkpass');
    const lm = r.headers.get('last-modified')!;
    const body = Buffer.from(await r.arrayBuffer());
    expect(passJsonOf(body).serialNumber).toBe(stamp());
    const r304 = await latestPass(new Request(url, { headers: { ...auth(stamp()), 'if-modified-since': lm } }), PT, stamp(), new Date(NOW));
    expect(r304.status).toBe(304);
    // Cambia el pase (un sello) → otra fecha → 200.
    const changed = buildApplePass({ kind: 'stamp', card: { ...card, customer: { ...card.customer, stamps: 1 } } }, appleWalletConfig()!, new Date(NOW));
    expect(changed.lastModified.toUTCString()).not.toBe(lm);
    const gone = await latestPass(new Request(url, { headers: auth('s.biz_no.cli_no') }), PT, 's.biz_no.cli_no');
    expect(gone.status).toBe(404);
  });

  it('pase de un cupón usado sale anulado', async () => {
    const serial = appleSerial('coupon', card.business.id, couponId);
    await repo.redeemCustomerOffer(card.business.id, couponId, ownerId);
    const r = await latestPass(new Request('https://stampaecu.app/x', { headers: auth(serial) }), PT, serial, new Date(NOW));
    expect(r.status).toBe(200);
    expect(passJsonOf(Buffer.from(await r.arrayBuffer())).voided).toBe(true);
  });

  it('baja (DELETE) y log', async () => {
    expect((await unregisterDevice(new Request('https://stampaecu.app/x', { method: 'DELETE' }), DEVICE, PT, stamp())).status).toBe(401);
    expect((await unregisterDevice(new Request('https://stampaecu.app/x', { method: 'DELETE', headers: auth(stamp()) }), DEVICE, PT, stamp())).status).toBe(200);
    expect(await repo.applePushTokensForSerial(PT, stamp())).toEqual([]);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logReq = () => new Request('https://stampaecu.app/x', { method: 'POST', body: JSON.stringify({ logs: ['error\nde prueba'] }) });
    // Sin APPLE_WALLET_DEBUG=on responde 200 pero no escribe nada (cualquiera puede llamar a esta ruta).
    expect((await deviceLog(logReq(), {} as NodeJS.ProcessEnv)).status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
    expect((await deviceLog(logReq(), { APPLE_WALLET_DEBUG: 'on' } as unknown as NodeJS.ProcessEnv)).status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][1])).toBe('error de prueba');
    spy.mockRestore();
  });

  it('sin dispositivos registrados, sync y notify no envían nada y no lanzan', async () => {
    await expect(syncApplePasses(card)).resolves.toBeUndefined();
    expect(await notifyApple(card, 'Nuevo cupón: 2x1 en capuchinos')).toBe(false);
    expect(await notifyApple(card, 'Otro texto')).toBe(false);
  });

  it('la fecha de contenido es estable y en segundos enteros', () => {
    const d = contentDate(Buffer.from('a'));
    expect(d.getTime() % 1000).toBe(0);
    expect(contentDate(Buffer.from('a')).getTime()).toBe(d.getTime());
    expect(contentDate(Buffer.from('b')).getTime()).not.toBe(d.getTime());
  });
});

describe('Apple Wallet: log del iPhone', () => {
  it('cleanLogLine quita saltos y caracteres de control y recorta', async () => {
    const { cleanLogLine } = await import('./webservice');
    expect(cleanLogLine('linea\nfalsa\r\u0000 ok')).toBe('linea falsa ok');
    expect(cleanLogLine('x'.repeat(500)).length).toBe(300);
  });
});
