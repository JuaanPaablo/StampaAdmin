import { describe, expect, it } from 'vitest';
import { COUNTER_CODE_EMPTY, COUNTER_CODE_UNKNOWN, COUNTER_COUPON_BAD, COUNTER_GIFT_BAD, parseCounterCode } from './counter-code';

describe('parseCounterCode', () => {
  it('lee el QR de un cupón', () => {
    expect(parseCounterCode('STAMPA-CUPON:cof_3f9a0c1b2d')).toEqual({ kind: 'coupon', id: 'cof_3f9a0c1b2d' });
    expect(parseCounterCode('  STAMPA-CUPON:cof_esquina_12 \n')).toEqual({ kind: 'coupon', id: 'cof_esquina_12' });
  });

  it('acepta el id del cupón escrito a mano y en mayúsculas', () => {
    expect(parseCounterCode('cof_esquina_12')).toEqual({ kind: 'coupon', id: 'cof_esquina_12' });
    expect(parseCounterCode('COF_ABC123')).toEqual({ kind: 'coupon', id: 'cof_abc123' });
  });

  it('tolera lectores en inglés sobre teclado en español', () => {
    expect(parseCounterCode("STAMPA'CUPONÑcof?esquina?12")).toEqual({ kind: 'coupon', id: 'cof_esquina_12' });
    expect(parseCounterCode("STAMPA'GIFTÑABCD-EFGH-JKMN")).toEqual({ kind: 'gift', code: 'ABCDEFGHJKMN' });
    expect(parseCounterCode('stampa-cupón:cof_x1')).toEqual({ kind: 'coupon', id: 'cof_x1' });
  });

  it('lee el QR de una gift card', () => {
    expect(parseCounterCode('STAMPA-GIFT:ABCDEFGHJKMN')).toEqual({ kind: 'gift', code: 'ABCDEFGHJKMN' });
  });

  it('acepta el código de la gift card escrito con espacios, guiones o minúsculas', () => {
    expect(parseCounterCode('abcd efgh jkmn')).toEqual({ kind: 'gift', code: 'ABCDEFGHJKMN' });
    expect(parseCounterCode('ABCD-EFGH-JKMN')).toEqual({ kind: 'gift', code: 'ABCDEFGHJKMN' });
  });

  it('explica qué falta cuando no reconoce el código', () => {
    expect(parseCounterCode('')).toEqual({ kind: 'invalid', error: COUNTER_CODE_EMPTY });
    expect(parseCounterCode('   ')).toEqual({ kind: 'invalid', error: COUNTER_CODE_EMPTY });
    expect(parseCounterCode('STAMPA-CUPON:')).toEqual({ kind: 'invalid', error: COUNTER_COUPON_BAD });
    expect(parseCounterCode('STAMPA-CUPON:ofr_123')).toEqual({ kind: 'invalid', error: COUNTER_COUPON_BAD });
    expect(parseCounterCode('STAMPA-GIFT:ABC')).toEqual({ kind: 'invalid', error: COUNTER_GIFT_BAD });
    expect(parseCounterCode('ABCD EFGH JKM0')).toEqual({ kind: 'invalid', error: COUNTER_CODE_UNKNOWN });
    expect(parseCounterCode('https://stampaecu.app/u/esquina/sello?c=123')).toEqual({ kind: 'invalid', error: COUNTER_CODE_UNKNOWN });
  });
});
