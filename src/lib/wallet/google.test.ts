import { generateKeyPairSync, createVerify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerCard } from '../contracts';
import {
  googleCouponSavePath, googleGiftSavePath, googleSaveUrl, googleWalletButtonVisible, googleWalletConfig, notifyGoogle,
  resetGoogleWalletCacheForTests, signJwt, syncGoogleWallet
} from './google';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const saB64 = Buffer.from(JSON.stringify({ client_email: 'wallet@demo.iam.gserviceaccount.com', private_key: pem })).toString('base64');
const env = (over: Record<string, string | undefined> = {}) => ({ GOOGLE_WALLET_ISSUER_ID: '3388000000023233833', GOOGLE_WALLET_SA_JSON_BASE64: saB64, ...over }) as unknown as NodeJS.ProcessEnv;

const card = {
  business: { id: 'b1', name: 'Café Azul', slug: 'cafe-azul' },
  program: { name: 'Tarjeta café', stampsRequired: 10, rewardTitle: 'Café gratis', colors: { bg: '#112233', ink: '#FFFFFF', accent: '#FFC301' }, logoText: 'CA', milestones: [] },
  customer: { id: 'c-1', name: 'Ana', stamps: 3 },
  recent: []
} as unknown as CustomerCard;

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('Google Wallet', () => {
  it('se desactiva sin variables o con la clave mal pegada', () => {
    expect(googleWalletConfig(env({ GOOGLE_WALLET_SA_JSON_BASE64: '' }))).toBeNull();
    expect(googleWalletConfig(env({ GOOGLE_WALLET_ISSUER_ID: 'abc' }))).toBeNull();
    expect(googleWalletConfig(env({ GOOGLE_WALLET_SA_JSON_BASE64: 'no-es-json' }))).toBeNull();
    expect(googleWalletConfig(env())?.issuerId).toBe('3388000000023233833');
  });

  it('en Production el botón queda oculto hasta GOOGLE_WALLET_PUBLIC=on', () => {
    expect(googleWalletButtonVisible(env({ VERCEL_ENV: 'preview' }))).toBe(true);
    expect(googleWalletButtonVisible(env({ VERCEL_ENV: 'production' }))).toBe(false);
    expect(googleWalletButtonVisible(env({ VERCEL_ENV: 'production', GOOGLE_WALLET_PUBLIC: 'on' }))).toBe(true);
    expect(googleWalletButtonVisible(env({ VERCEL_ENV: 'preview', GOOGLE_WALLET_SA_JSON_BASE64: '' }))).toBe(false);
  });

  it('rutas de guardado de cupón y gift card', () => {
    expect(googleCouponSavePath('cafe-azul', 'cof_1')).toBe('/u/cafe-azul/wallet/google/cupon/cof_1');
    expect(googleGiftSavePath('cafe-azul', 'gft_1')).toBe('/u/cafe-azul/wallet/google/gift/gft_1');
  });

  it('firma el JWT con RS256 verificable con la clave pública', () => {
    const jwt = signJwt({ a: 1 }, pem);
    const [h, p, s] = jwt.split('.');
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('el enlace de guardar lleva la clase del negocio y el objeto del cliente', () => {
    const url = googleSaveUrl(card, googleWalletConfig(env())!, new Date('2026-11-23T12:00:00Z'));
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    const body = decode(url.split('/').pop()!.split('.')[1]);
    expect(body).toMatchObject({ iss: 'wallet@demo.iam.gserviceaccount.com', aud: 'google', typ: 'savetowallet' });
    const [cls] = body.payload.loyaltyClasses;
    const [obj] = body.payload.loyaltyObjects;
    expect(cls.id).toBe('3388000000023233833.stampa_b1');
    expect(cls.programLogo.sourceUri.uri).toMatch(/^https?:\/\//);
    expect(obj).toMatchObject({ id: '3388000000023233833.c-1', classId: cls.id, accountName: 'Ana' });
    expect(obj.loyaltyPoints.balance.string).toBe('3 de 10');
    expect(obj).not.toHaveProperty('merchantLocations');
  });

  it('las sucursales con coordenadas de la tarjeta van en merchantLocations', () => {
    const withLocs = { ...card, locations: [{ id: 'l1', businessId: 'b1', name: 'Urdesa', active: true, latitude: -2.172, longitude: -79.905 }] } as CustomerCard;
    const url = googleSaveUrl(withLocs, googleWalletConfig(env())!, new Date('2026-11-23T12:00:00Z'));
    const [obj] = decode(url.split('/').pop()!.split('.')[1]).payload.loyaltyObjects;
    expect(obj.merchantLocations).toEqual([{ latitude: -2.172, longitude: -79.905 }]);
    expect(obj).not.toHaveProperty('locations');
  });
});

/* ---------- API con fetch simulado ---------- */

type Call = { method: string; url: string; body: any };

function mockFetch(handler: (c: Call) => { status: number; body?: string }) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    }
    const c: Call = { method: init.method ?? 'GET', url, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = handler(c);
    return new Response(r.body ?? '{}', { status: r.status });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const offer = {
  id: 'ofr_1', businessId: 'b1', title: '2x1', description: 'Promo', startsAt: '2026-11-01T05:00:00.000Z',
  endsAt: '2099-12-01T04:59:59.000Z', status: 'sent', createdAt: '2026-11-01T00:00:00Z'
};
const fullCard = (wallet?: 'google' | 'apple') => ({
  ...card,
  customer: { ...(card.customer as object), wallet },
  locations: [],
  offers: [{ id: 'cof_1', offerId: 'ofr_1', businessId: 'b1', customerId: 'c-1', createdAt: '2026-11-02T00:00:00Z', offer }],
  giftCards: [{ id: 'gft_1', businessId: 'b1', customerId: 'c-1', code: 'ABCD2345WXYZ', balanceCents: 500, initialCents: 1000, status: 'active', createdAt: '2026-11-01T00:00:00Z' }]
}) as unknown as CustomerCard;

describe('Google Wallet API', () => {
  beforeEach(() => {
    resetGoogleWalletCacheForTests();
    vi.stubEnv('GOOGLE_WALLET_ISSUER_ID', '3388000000023233833');
    vi.stubEnv('GOOGLE_WALLET_SA_JSON_BASE64', saB64);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('notifyGoogle: addMessage con TEXT_AND_NOTIFY, encabezado = negocio e id único', async () => {
    const calls = mockFetch(() => ({ status: 200 }));
    expect(await notifyGoogle(card, '  Nuevo cupón: 2x1 ')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/3388000000023233833.c-1/addMessage');
    expect(calls[0].body.message).toMatchObject({ header: 'Café Azul', body: 'Nuevo cupón: 2x1', messageType: 'TEXT_AND_NOTIFY' });
    expect(calls[0].body.message.id).toMatch(/^stampa_[\w]+$/);
    await notifyGoogle(card, 'otro');
    expect(calls[1].body.message.id).not.toBe(calls[0].body.message.id);
  });

  it('notifyGoogle: con tope de Google manda TEXT y devuelve false; 404 → false sin reintento', async () => {
    let n = 0;
    const calls = mockFetch(() => (n++ === 0 ? { status: 429, body: '{"error":{"message":"QuotaExceededException"}}' } : { status: 200 }));
    expect(await notifyGoogle(card, 'hola')).toBe(false);
    expect(calls.map((c) => c.body.message.messageType)).toEqual(['TEXT_AND_NOTIFY', 'TEXT']);

    const calls404 = mockFetch(() => ({ status: 404 }));
    expect(await notifyGoogle(card, 'hola')).toBe(false);
    expect(calls404).toHaveLength(1);
  });

  it('notifyGoogle nunca lanza (fallo de red)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red caída'); }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyGoogle(card, 'hola')).resolves.toBe(false);
    err.mockRestore();
  });

  it('sync con tarjeta guardada: crea clase y objeto del cupón y los enlaza con linkedOfferIds', async () => {
    const calls = mockFetch((c) => (c.method === 'PATCH' && /offer(Class|Object)\//.test(c.url) ? { status: 404 } : { status: 200 }));
    await syncGoogleWallet(fullCard('google'));
    const sig = calls.map((c) => `${c.method} ${c.url.split('/v1/')[1].split('/')[0]}`);
    expect(sig).toEqual([
      'PATCH offerClass', 'POST offerClass', 'PATCH offerObject', 'POST offerObject', 'PATCH loyaltyObject', 'PATCH giftCardObject'
    ]);
    const postObj = calls[3].body;
    expect(postObj).toMatchObject({ id: '3388000000023233833.cof_1', classId: '3388000000023233833.stampa_b1_ofr_1', state: 'ACTIVE' });
    expect(calls[4].body.linkedOfferIds).toEqual(['3388000000023233833.cof_1']);
    expect(calls[5].body.balance).toEqual({ micros: '5000000', currencyCode: 'USD' });
  });

  it('sync sin tarjeta guardada: solo PATCH (404 se ignora) y sin linkedOfferIds', async () => {
    const calls = mockFetch(() => ({ status: 404 }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await syncGoogleWallet(fullCard(undefined));
    expect(calls.every((c) => c.method === 'PATCH')).toBe(true);
    expect(calls.map((c) => c.url.split('/v1/')[1].split('/')[0])).toEqual(['offerObject', 'loyaltyObject', 'giftCardObject']);
    expect(calls[1].body).not.toHaveProperty('linkedOfferIds');
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('la clase de un cupón se asegura una sola vez aunque se sincronicen varios clientes a la vez', async () => {
    const calls = mockFetch(() => ({ status: 200 }));
    await Promise.all([syncGoogleWallet(fullCard('google')), syncGoogleWallet(fullCard('google'))]);
    expect(calls.filter((c) => c.url.includes('/offerClass/')).length).toBe(1);
  });
});
