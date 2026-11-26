import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GiftCard } from '../contracts';
import { googleBrand, googleWalletConfig } from './google';
import { centsToMoney, giftCardClassFor, googleGiftCardObject, googleGiftCardSaveUrl } from './google-giftcard';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const saB64 = Buffer.from(JSON.stringify({ client_email: 'wallet@demo.iam.gserviceaccount.com', private_key: pem })).toString('base64');
const ISSUER = '3388000000023233833';
const config = googleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: ISSUER, GOOGLE_WALLET_SA_JSON_BASE64: saB64 } as unknown as NodeJS.ProcessEnv)!;

const program = { name: 'Tarjeta', stampsRequired: 10, rewardTitle: 'Premio', colors: { bg: '#001D3D' }, logoText: 'X', milestones: [] } as never;
const brand = googleBrand({ id: 'biz 1', name: 'Café', slug: 'cafe' }, program);
const gift: GiftCard = {
  id: 'gft_9', businessId: 'biz 1', customerId: 'c1', code: 'ABCD2345WXYZ', balanceCents: 1250, initialCents: 2000,
  status: 'active', createdAt: '2026-11-01T00:00:00Z'
};

describe('Google Wallet: gift cards', () => {
  it('saldo en micros (texto) y USD', () => {
    expect(centsToMoney(1250)).toEqual({ micros: '12500000', currencyCode: 'USD' });
    expect(centsToMoney(0)).toEqual({ micros: '0', currencyCode: 'USD' });
    expect(centsToMoney(50000).micros).toBe('500000000');
  });

  it('clase por negocio con id seguro', () => {
    const cls = giftCardClassFor(brand, ISSUER);
    expect(cls.id).toBe(`${ISSUER}.stampa_biz_1_gift`);
    expect(cls).toMatchObject({ merchantName: 'Café', reviewStatus: 'UNDER_REVIEW', hexBackgroundColor: '#001D3D' });
    expect(cls).not.toHaveProperty('merchantLocations');
  });

  it('objeto: código formateado, QR fijo, estados y aviso opcional', () => {
    const obj = googleGiftCardObject(brand, gift, ISSUER, { balanceUpdatedAt: '2026-11-20T10:00:00.000Z' });
    expect(obj).toMatchObject({ id: `${ISSUER}.gft_9`, classId: `${ISSUER}.stampa_biz_1_gift`, state: 'ACTIVE', cardNumber: 'ABCD-2345-WXYZ' });
    expect(obj.barcode).toEqual({ type: 'QR_CODE', value: 'STAMPA-GIFT:ABCD2345WXYZ', alternateText: 'ABCD 2345 WXYZ' });
    expect(obj.balance).toEqual({ micros: '12500000', currencyCode: 'USD' });
    expect(obj.balanceUpdateTime).toEqual({ date: '2026-11-20T10:00:00.000Z' });
    expect(obj).not.toHaveProperty('notifyPreference');
    expect(googleGiftCardObject(brand, gift, ISSUER, { notify: true }).notifyPreference).toBe('NOTIFY');
    const voided = googleGiftCardObject(brand, { ...gift, status: 'void' }, ISSUER);
    expect(voided.state).toBe('INACTIVE');
    expect(voided.balance.micros).toBe('0');
  });

  it('enlace de guardar con giftCardClasses y giftCardObjects', () => {
    const url = googleGiftCardSaveUrl(brand, gift, config, new Date('2026-11-20T12:00:00Z'));
    const body = JSON.parse(Buffer.from(url.split('/').pop()!.split('.')[1], 'base64url').toString('utf8'));
    expect(body.typ).toBe('savetowallet');
    expect(body.payload.giftCardClasses[0].id).toBe(body.payload.giftCardObjects[0].classId);
    expect(body.payload.giftCardObjects[0].barcode.value).toBe('STAMPA-GIFT:ABCD2345WXYZ');
  });
});
