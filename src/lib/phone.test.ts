import { describe, expect, it } from 'vitest';
import { formatEcPhone, isEcPhone, localEcPhone, normalizeEcPhone, PHONE_ERROR } from './phone';
import { ownerWhatsappUrl } from './urls';

describe('celular de Ecuador', () => {
  it('acepta los formatos comunes y normaliza a E.164', () => {
    for (const raw of ['0991234567', '099 123 4567', '099-123-4567', '(099) 123-4567', '+593991234567', '+593 99 123 4567', '593991234567', '991234567', '+593 099 123 4567', ' 0991234567 ']) {
      expect(normalizeEcPhone(raw), raw).toEqual({ ok: true, phone: '+593991234567' });
    }
  });

  it('rechaza fijos, largos incorrectos, letras y otros países', () => {
    for (const raw of ['', '042345678', '02 234 5678', '09912345', '09912345678', '+1 305 123 4567', '+59399123456', 'abc0991234567', '099+1234567', 12345]) {
      expect(normalizeEcPhone(raw), String(raw)).toEqual({ ok: false, error: PHONE_ERROR });
    }
    expect(isEcPhone('0991234567')).toBe(true);
    expect(isEcPhone('0421234567')).toBe(false);
  });

  it('formatos para mostrar y enlace de WhatsApp', () => {
    expect(formatEcPhone('+593991234567')).toBe('+593 99 123 4567');
    expect(localEcPhone('+593991234567')).toBe('099 123 4567');
    expect(formatEcPhone(undefined)).toBe('');
    expect(ownerWhatsappUrl('+593991234567')).toBe('https://wa.me/593991234567');
    expect(ownerWhatsappUrl('+593991234567', 'Hola, ¿cómo vas?')).toBe('https://wa.me/593991234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20vas%3F');
    expect(ownerWhatsappUrl(undefined)).toBeNull();
  });
});
