import { describe, expect, it } from 'vitest';
import { couponQrText, detectPlatform, ecDate, giftQrText, spacedGiftCode, validityText, walletButtons, walletHref } from './wallet-model';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('detectPlatform', () => {
  it('reconoce iPhone, iPad y Android', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
    expect(detectPlatform(IPAD)).toBe('ios');
    expect(detectPlatform(ANDROID)).toBe('android');
  });
  it('computadora, iPad en modo escritorio o sin user-agent: no se sabe', () => {
    expect(detectPlatform(WINDOWS)).toBe('unknown');
    expect(detectPlatform(MAC)).toBe('unknown');
    expect(detectPlatform('')).toBe('unknown');
    expect(detectPlatform(null)).toBe('unknown');
  });
});

describe('walletButtons', () => {
  const both = { apple: true, google: true };
  it('solo el de su plataforma cuando está clara', () => {
    expect(walletButtons('ios', both)).toEqual(['apple']);
    expect(walletButtons('android', both)).toEqual(['google']);
  });
  it('ambos cuando no se sabe, Apple primero', () => {
    expect(walletButtons('unknown', both)).toEqual(['apple', 'google']);
  });
  it('respeta lo que está configurado', () => {
    expect(walletButtons('unknown', { apple: false, google: true })).toEqual(['google']);
    expect(walletButtons('ios', { apple: false, google: true })).toEqual([]);
    expect(walletButtons('android', { apple: true, google: false })).toEqual([]);
  });
});

describe('enlaces y QR', () => {
  it('usa las rutas fijas', () => {
    expect(walletHref('esquina', 'google')).toBe('/u/esquina/wallet/google');
    expect(walletHref('esquina', 'apple', { type: 'cupon', id: 'cof_1' })).toBe('/u/esquina/wallet/apple/cupon/cof_1');
    expect(walletHref('esquina', 'google', { type: 'gift', id: 'gft_1' })).toBe('/u/esquina/wallet/google/gift/gft_1');
  });
  it('arma el contenido fijo de los QR', () => {
    expect(couponQrText('cof_1')).toBe('STAMPA-CUPON:cof_1');
    expect(giftQrText('ABCDEFGHJKMN')).toBe('STAMPA-GIFT:ABCDEFGHJKMN');
    expect(spacedGiftCode('ABCDEFGHJKMN')).toBe('ABCD EFGH JKMN');
  });
});

describe('fechas en hora de Ecuador', () => {
  it('un cupón que vence a las 23:59 de Ecuador muestra ese día, no el siguiente', () => {
    // 2026-11-30 23:59:59 en Ecuador = 2026-12-01 04:59:59 UTC
    expect(ecDate('2026-12-01T04:59:59.000Z')).toMatch(/^30 nov/);
  });
  it('validez antes y después de empezar', () => {
    const starts = '2026-12-01T05:00:00.000Z';
    const ends = '2026-12-16T04:59:59.000Z';
    expect(validityText(starts, ends, Date.parse('2026-11-20T12:00:00Z'))).toMatch(/^Válido del 1 dic 2026 al 15 dic 2026$/);
    expect(validityText(starts, ends, Date.parse('2026-12-05T12:00:00Z'))).toBe('Válido hasta el 15 dic 2026');
  });
});
