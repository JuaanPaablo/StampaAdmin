import { describe, expect, it } from 'vitest';
import {
  campaignLimitError, campaignMonthStartIso, campaignsRemaining, canNotify, cleanOfferInput, customerOfferRedeemError,
  ecStartOfDayIso, formatGiftCardCode, generateGiftCardCode, GIFT_CARD_ALPHABET, isOfferLive, liveCustomerOffers,
  maskGiftCardCode, normalizeGiftCardCode, notifyWindowStartIso, offerStatusLabel, offerWindowFromDays, parseCoordsInput,
  parseGiftCardAmount, validateCoords, validateGiftCardCharge, validateGiftCardLoad, validateOffer, walletFeatureError,
  WALLET_NOTIFY_MAX
} from './wallet-cards';
import { features } from '../plans';

const NOW = Date.parse('2026-11-26T15:00:00Z');   // 10:00 en Ecuador
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('plan', () => {
  it('cupones desde Standard, gift cards solo en Pro', () => {
    expect([features('basico').offers, features('standard').offers, features('pro').offers]).toEqual([false, true, true]);
    expect([features('basico').giftCards, features('standard').giftCards, features('pro').giftCards]).toEqual([false, false, true]);
    expect(walletFeatureError('basico', 'offers')).toBe('Los cupones están disponibles desde el plan Standard.');
    expect(walletFeatureError('standard', 'giftCards')).toBe('Las gift cards están disponibles en el plan Pro.');
    expect(walletFeatureError('pro', 'giftCards')).toBeNull();
  });

  it('campañas restantes del mes según el plan (2 / 8), nunca negativas', () => {
    expect(campaignsRemaining('basico', 0)).toBe(0);
    expect(campaignsRemaining('standard', 1)).toBe(1);
    expect(campaignsRemaining('standard', 5)).toBe(0);
    expect(campaignsRemaining('pro', 3)).toBe(5);
    expect(campaignLimitError('standard')).toContain('2 cupones por mes');
  });

  it('el mes de campañas empieza a las 00:00 de Ecuador del día 1', () => {
    expect(campaignMonthStartIso(NOW)).toBe('2026-11-01T05:00:00.000Z');
    // 1 dic 02:00 UTC todavía es 30 nov en Ecuador
    expect(campaignMonthStartIso(Date.parse('2026-12-01T02:00:00Z'))).toBe('2026-11-01T05:00:00.000Z');
  });
});

describe('tope de avisos', () => {
  it('máximo 3 cada 24 h', () => {
    expect(WALLET_NOTIFY_MAX).toBe(3);
    expect([0, 1, 2, 3, 4].map(canNotify)).toEqual([true, true, true, false, false]);
    expect(notifyWindowStartIso(NOW)).toBe(iso(NOW - DAY));
  });
});

describe('cupones', () => {
  const base = cleanOfferInput({ title: '  2x1 en   capuchinos ', description: 'Lleva dos y paga uno.', startsAt: iso(NOW), endsAt: iso(NOW + 7 * DAY), terms: '  ' });

  it('limpia el formulario y valida', () => {
    expect(base.title).toBe('2x1 en capuchinos');
    expect(base.terms).toBeUndefined();
    expect(validateOffer(base, NOW)).toBeNull();
    expect(validateOffer({ ...base, title: 'x' }, NOW)?.field).toBe('title');
    expect(validateOffer({ ...base, title: 'x'.repeat(41) }, NOW)?.error).toContain('40');
    expect(validateOffer({ ...base, description: 'y'.repeat(201) }, NOW)?.field).toBe('description');
    expect(validateOffer({ ...base, terms: 'z'.repeat(301) }, NOW)?.field).toBe('terms');
    expect(validateOffer({ ...base, imageUrl: 'http://inseguro.ec/a.png' }, NOW)?.field).toBe('imageUrl');
    expect(validateOffer({ ...base, imageUrl: 'https://cdn.ec/a.png' }, NOW)).toBeNull();
    expect(validateOffer({ ...base, endsAt: base.startsAt }, NOW)?.field).toBe('endsAt');
    expect(validateOffer({ ...base, startsAt: iso(NOW - 10 * DAY), endsAt: iso(NOW - DAY) }, NOW)?.error).toBe('La fecha final ya pasó.');
    expect(validateOffer({ ...base, endsAt: iso(NOW + 400 * DAY) }, NOW)?.error).toContain('un año');
    expect(validateOffer({ ...base, startsAt: 'mañana' }, NOW)?.field).toBe('startsAt');
  });

  it('la vigencia por días usa el calendario de Ecuador', () => {
    expect(ecStartOfDayIso('2026-11-26')).toBe('2026-11-26T05:00:00.000Z');
    expect(offerWindowFromDays('2026-11-26', '2026-11-30')).toEqual({ startsAt: '2026-11-26T05:00:00.000Z', endsAt: '2026-12-01T04:59:59.000Z' });
    expect(offerWindowFromDays('2026-02-30', '2026-03-01')).toBeNull();
  });

  it('vigente, canjeable y estado legible', () => {
    const offer = { status: 'sent' as const, startsAt: iso(NOW - DAY), endsAt: iso(NOW + DAY) };
    expect(isOfferLive(offer, NOW)).toBe(true);
    expect(isOfferLive({ ...offer, status: 'draft' }, NOW)).toBe(false);
    expect(customerOfferRedeemError({}, offer, NOW)).toBeNull();
    expect(customerOfferRedeemError({ redeemedAt: iso(NOW) }, offer, NOW)).toBe('Este cupón ya se usó.');
    expect(customerOfferRedeemError({}, { ...offer, status: 'ended' }, NOW)).toBe('Este cupón ya terminó.');
    expect(customerOfferRedeemError({}, offer, NOW + 2 * DAY)).toBe('Este cupón ya venció.');
    expect(customerOfferRedeemError({}, offer, NOW - 2 * DAY)).toBe('Este cupón todavía no está vigente.');
    expect(offerStatusLabel(offer, NOW)).toBe('Vigente');
    expect(offerStatusLabel(offer, NOW + 2 * DAY)).toBe('Vencido');
    expect(offerStatusLabel({ ...offer, status: 'draft' }, NOW)).toBe('Borrador');
  });

  it('la tarjeta muestra solo cupones vigentes sin usar, el que vence antes primero', () => {
    const mk = (id: string, endsIn: number, extra: object = {}) => ({ id, offer: { status: 'sent' as const, startsAt: iso(NOW - DAY), endsAt: iso(NOW + endsIn * DAY) }, ...extra });
    const list = [mk('a', 5), mk('b', 1), mk('c', 3, { redeemedAt: iso(NOW) }), mk('d', -1)];
    expect(liveCustomerOffers(list, NOW).map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('gift cards', () => {
  it('genera códigos de 12 caracteres sin ambiguos', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateGiftCardCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
    expect(GIFT_CARD_ALPHABET).not.toMatch(/[01ILO]/);
    let i = 0;
    expect(generateGiftCardCode(() => ((i++ % 31) + 0.5) / 31)).toBe('ABCDEFGHJKMN');
  });

  it('normaliza lo que escribe Caja: minúsculas, espacios y guiones', () => {
    expect(normalizeGiftCardCode('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
    expect(normalizeGiftCardCode(' ABCD EFGH  JKMN ')).toBe('ABCDEFGHJKMN');
    expect(normalizeGiftCardCode('ABCD—EFGH_JKMN')).toBe('ABCDEFGHJKMN');
    expect(normalizeGiftCardCode('ABCD-EFGH-JKM')).toBeNull();
    expect(normalizeGiftCardCode('ABCD-EFGH-JKM0')).toBeNull();    // 0 no está en el alfabeto
    expect(normalizeGiftCardCode(undefined)).toBeNull();
    expect(formatGiftCardCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
    expect(maskGiftCardCode('ABCDEFGHJKMN')).toBe('•••• •••• JKMN');
  });

  it('montos: reusa parseAmountCents y respeta el tope de US$500', () => {
    expect(parseGiftCardAmount('12,50')).toEqual({ ok: true, cents: 1250 });
    expect(parseGiftCardAmount('$20')).toEqual({ ok: true, cents: 2000 });
    expect(parseGiftCardAmount('abc').ok).toBe(false);
    expect(validateGiftCardLoad(50)).toContain('mínimo');
    expect(validateGiftCardLoad(50_000)).toBeNull();
    expect(validateGiftCardLoad(50_001)).toContain('$500,00');
    expect(validateGiftCardLoad(1_000, 49_500)).toContain('hasta $5,00');
    expect(validateGiftCardCharge(1_000, { balanceCents: 500, status: 'active' })).toBe('Saldo insuficiente: quedan $5,00.');
    expect(validateGiftCardCharge(500, { balanceCents: 500, status: 'active' })).toBeNull();
    expect(validateGiftCardCharge(100, { balanceCents: 500, status: 'void' })).toBe('Esta gift card está anulada.');
    expect(validateGiftCardCharge(0, { balanceCents: 500, status: 'active' })).toBe('Escribe el monto a cobrar.');
  });
});

describe('coordenadas', () => {
  it('valida rangos', () => {
    expect(validateCoords(-2.17, -79.9)).toBeNull();
    expect(validateCoords(91, 0)).toContain('latitud');
    expect(validateCoords(0, 181)).toContain('longitud');
    expect(validateCoords(0, 0)).not.toBeNull();
    expect(validateCoords(Number.NaN, 1)).not.toBeNull();
  });

  it('lee coordenadas pegadas o de enlaces de Google Maps', () => {
    expect(parseCoordsInput('-2.1720344, -79.9050213')).toEqual({ latitude: -2.172034, longitude: -79.905021 });
    expect(parseCoordsInput('https://www.google.com/maps/place/Urdesa/@-2.1720344,-79.9050213,17z/data=!3m1')).toEqual({ latitude: -2.172034, longitude: -79.905021 });
    expect(parseCoordsInput('https://maps.google.com/?q=-0.199764,-78.486412')).toEqual({ latitude: -0.199764, longitude: -78.486412 });
    expect(parseCoordsInput('https://www.google.com/maps/place/x/data=!3d-2.9008!4d-79.0052')).toEqual({ latitude: -2.9008, longitude: -79.0052 });
    expect(parseCoordsInput('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseCoordsInput('100, 200')).toBeNull();
    expect(parseCoordsInput('%E0%A4%A')).toBeNull();
  });
});

describe('cleanRequestId', () => {
  it('acepta uuid e ids cortos sin símbolos; rechaza lo demás', async () => {
    const { cleanRequestId } = await import('./wallet-cards');
    expect(cleanRequestId('0f8c1b2a-1d2e-4f00-9abc-0123456789ab')).toBe('0f8c1b2a-1d2e-4f00-9abc-0123456789ab');
    expect(cleanRequestId('  abcdef12  ')).toBe('abcdef12');
    expect(cleanRequestId('corto')).toBeUndefined();
    expect(cleanRequestId("x'; drop table--")).toBeUndefined();
    expect(cleanRequestId('a'.repeat(65))).toBeUndefined();
    expect(cleanRequestId(null)).toBeUndefined();
  });
});
