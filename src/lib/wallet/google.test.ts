import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CustomerCard } from '../contracts';
import { googleSaveUrl, googleWalletButtonVisible, googleWalletConfig, signJwt } from './google';

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
  });
});
