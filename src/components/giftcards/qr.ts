import QRCode from 'qrcode';
import { giftQrValue } from './gift-format';

/** QR de una gift card en SVG (contenido STAMPA-GIFT:<código>). Solo servidor. */
export function giftQrSvg(code: string): Promise<string> {
  return QRCode.toString(giftQrValue(code), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#001D3D', light: '#FFFFFF' } });
}
