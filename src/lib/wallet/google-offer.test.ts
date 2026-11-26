import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CustomerOfferWithOffer, Offer } from '../contracts';
import { googleBrand, googleWalletConfig } from './google';
import { couponQrValue, googleOfferObject, googleOfferSaveUrl, offerClassFor, offerObjectState } from './google-offer';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const saB64 = Buffer.from(JSON.stringify({ client_email: 'wallet@demo.iam.gserviceaccount.com', private_key: pem })).toString('base64');
const ISSUER = '3388000000023233833';
const config = googleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: ISSUER, GOOGLE_WALLET_SA_JSON_BASE64: saB64 } as unknown as NodeJS.ProcessEnv)!;

const program = { name: 'Tarjeta café', stampsRequired: 10, rewardTitle: 'Café gratis', colors: { bg: '#112233', ink: '#FFFFFF', accent: '#FFC301' }, logoText: 'CA', milestones: [] } as never;
const brand = googleBrand({ id: 'biz_1', name: 'Café Azul con nombre muy largo', slug: 'cafe-azul' }, program, [
  { name: 'Urdesa', latitude: -2.17, longitude: -79.9 }, { name: 'Sin coords' }
]);

const offer: Offer = {
  id: 'ofr_ab:c', businessId: 'biz_1', title: '2x1 en capuchino', description: 'Solo hoy', terms: 'Uno por cliente',
  imageUrl: 'https://img.example/cap.jpg', startsAt: '2026-11-01T05:00:00.000Z', endsAt: '2026-12-01T04:59:59.000Z',
  status: 'sent', createdAt: '2026-11-01T00:00:00.000Z'
};
const co: CustomerOfferWithOffer = { id: 'cof_123', offerId: offer.id, businessId: 'biz_1', customerId: 'c1', createdAt: '2026-11-02T00:00:00Z', offer };
const NOW = Date.parse('2026-11-20T12:00:00Z');

describe('Google Wallet: cupones', () => {
  it('clase: campos obligatorios, imagen https, ids seguros y sucursales', () => {
    const cls = offerClassFor(brand, offer, ISSUER);
    expect(cls.id).toBe(`${ISSUER}.stampa_biz_1_ofr_ab_c`);
    expect(cls.id.slice(ISSUER.length + 1)).toMatch(/^[\w.-]+$/);
    expect(cls).toMatchObject({
      title: '2x1 en capuchino', provider: 'Café Azul con nombre muy largo', redemptionChannel: 'INSTORE',
      reviewStatus: 'UNDER_REVIEW', details: 'Solo hoy', finePrint: 'Uno por cliente', hexBackgroundColor: '#112233'
    });
    expect(cls.issuerName.length).toBeLessThanOrEqual(20);
    expect(cls.heroImage?.sourceUri.uri).toBe('https://img.example/cap.jpg');
    expect(cls.titleImage.sourceUri.uri).toMatch(/^https:\/\//);
    expect(cls.merchantLocations).toEqual([{ latitude: -2.17, longitude: -79.9 }]);
    const plain = offerClassFor(brand, { ...offer, imageUrl: 'http://inseguro/x.jpg', terms: undefined }, ISSUER);
    expect(plain).not.toHaveProperty('heroImage');
    expect(plain).not.toHaveProperty('finePrint');
  });

  it('objeto: QR fijo, vigencia y estados', () => {
    const obj = googleOfferObject(brand, co, ISSUER, NOW);
    expect(obj.id).toBe(`${ISSUER}.cof_123`);
    expect(obj.classId).toBe(offerClassFor(brand, offer, ISSUER).id);
    expect(obj.barcode).toMatchObject({ type: 'QR_CODE', value: 'STAMPA-CUPON:cof_123' });
    expect(couponQrValue('cof_x')).toBe('STAMPA-CUPON:cof_x');
    expect(obj.validTimeInterval).toEqual({ start: { date: offer.startsAt }, end: { date: offer.endsAt } });
    expect(obj.state).toBe('ACTIVE');
    expect(offerObjectState({ ...co, redeemedAt: '2026-11-10T00:00:00Z' }, NOW)).toBe('COMPLETED');
    expect(offerObjectState({ ...co, offer: { ...offer, status: 'ended' } }, NOW)).toBe('EXPIRED');
    expect(offerObjectState(co, Date.parse('2026-12-05T00:00:00Z'))).toBe('EXPIRED');
  });

  it('enlace de guardar con offerClasses y offerObjects', () => {
    const url = googleOfferSaveUrl(brand, co, config, new Date(NOW));
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    const body = JSON.parse(Buffer.from(url.split('/').pop()!.split('.')[1], 'base64url').toString('utf8'));
    expect(body).toMatchObject({ aud: 'google', typ: 'savetowallet', iss: 'wallet@demo.iam.gserviceaccount.com' });
    expect(body.payload.offerClasses[0].id).toBe(body.payload.offerObjects[0].classId);
    expect(body.payload.offerObjects[0].barcode.value).toBe('STAMPA-CUPON:cof_123');
  });
});
