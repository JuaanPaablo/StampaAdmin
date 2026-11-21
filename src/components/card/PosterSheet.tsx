import { Isotipo } from '@/components/shell/logo';
import { normalizeHex, readableOn } from './contrast';
import { safeImageUrl } from './images';

export type PosterSize = 'a4' | 'a6';

export interface PosterProps {
  businessName: string;
  logoText: string;
  logoUrl?: string;
  /** Color de acento de la tarjeta: fondo del círculo del logo cuando no hay imagen. */
  accent: string;
  /** Dirección pública que codifica el QR (customerUrl(slug)). */
  signupUrl: string;
  qrSvg: string;
  rewardTitle: string;
  stampsRequired: number;
  size: PosterSize;
}

/**
 * CSS del póster "Pide tu sello aquí" (manual de marca, 6.3): Azul Noche, título con "sello" en Amarillo Sello,
 * QR sobre blanco y la dirección en amarillo. Todo se mide en cqw (porcentaje del ancho de la hoja) para que A4 y A6
 * compartan diseño.
 */
export function posterCss(size: PosterSize): string {
  const dims = size === 'a6' ? { w: '105mm', h: '148mm', page: 'A6' } : { w: '210mm', h: '297mm', page: 'A4' };
  return `
.poster-wrap{display:flex;justify-content:center}
.poster-sheet{container-type:inline-size;width:100%;max-width:${dims.w};aspect-ratio:${size === 'a6' ? '105 / 148' : '210 / 297'};background:linear-gradient(160deg,#013565 0%,#001D3D 55%);color:#fff;box-shadow:0 10px 30px rgba(0,29,61,.25);overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:Inter,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.poster-brand{display:flex;align-items:center;gap:1.6cqw;margin-top:6cqw;font-family:Sora,Inter,system-ui,sans-serif;font-weight:700;font-size:4.2cqw;letter-spacing:-.02em}
.poster-brand svg{width:5.2cqw;height:5.2cqw}
.poster-biz{display:flex;flex-direction:column;align-items:center;gap:2.4cqw;margin-top:6cqw;padding:0 8cqw}
.poster-logo{width:17cqw;height:17cqw;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:6.4cqw;overflow:hidden;flex:none;font-family:Sora,Inter,system-ui,sans-serif;box-shadow:0 0 0 1cqw rgba(255,255,255,.12)}
.poster-logo img{width:100%;height:100%;object-fit:cover;background:#fff}
.poster-name{font-family:Sora,Inter,system-ui,sans-serif;font-weight:600;font-size:4.6cqw;line-height:1.15;overflow-wrap:anywhere;margin:0}
.poster-title{font-family:Sora,Inter,system-ui,sans-serif;font-weight:800;font-size:10.5cqw;line-height:1.02;letter-spacing:-.035em;margin:5cqw 6cqw 0}
.poster-title em{font-style:normal;color:#FFC301}
.poster-qrbox{margin:6cqw auto 0;width:46cqw;height:46cqw;padding:3cqw;background:#fff;border-radius:4.5cqw}
.poster-qrbox svg{display:block;width:100%;height:100%}
.poster-scan{margin:4cqw 8cqw 0;font-size:3.3cqw;line-height:1.45;color:#C9D6E3}
.poster-reward{margin:5cqw 8cqw 0;border-radius:3cqw;padding:2.8cqw 5cqw;font-size:3.2cqw;line-height:1.3;background:rgba(255,255,255,.08)}
.poster-reward strong{display:block;font-family:Sora,Inter,system-ui,sans-serif;font-size:4.4cqw;margin-top:.6cqw;color:#fff}
.poster-url{margin-top:auto;padding:0 6cqw 6.5cqw;font-family:Sora,Inter,system-ui,sans-serif;font-weight:700;font-size:3.6cqw;color:#FFC301;word-break:break-all}
@media print{
  @page{size:${dims.page} portrait;margin:0}
  html,body{margin:0!important;padding:0!important;height:${dims.h}!important;overflow:hidden!important;background:#fff!important}
  body *{visibility:hidden!important}
  [data-noprint]{display:none!important}
  .poster-sheet,.poster-sheet *{visibility:visible!important}
  .poster-sheet{position:fixed!important;left:0;top:0;width:${dims.w}!important;max-width:none!important;height:${dims.h}!important;box-shadow:none!important}
}`;
}

export function PosterSheet(p: PosterProps) {
  const accent = normalizeHex(p.accent) ?? '#FFC301';
  const logo = safeImageUrl(p.logoUrl);
  const hostPath = p.signupUrl.replace(/^https?:\/\//, '');
  return (
    <div className="poster-wrap">
      <style dangerouslySetInnerHTML={{ __html: posterCss(p.size) }} />
      <article className="poster-sheet" aria-label={`Póster de ${p.businessName}, tamaño ${p.size.toUpperCase()}`}>
        <div className="poster-brand">
          <Isotipo size={20} /> <span aria-hidden="true">stampa</span>
        </div>
        <div className="poster-biz">
          <span className="poster-logo" style={logo ? undefined : { background: accent, color: readableOn(accent) }} aria-hidden="true">
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt="" referrerPolicy="no-referrer" />
              : (p.logoText || p.businessName).slice(0, 3).toUpperCase()}
          </span>
          <h2 className="poster-name">{p.businessName}</h2>
        </div>
        <p className="poster-title">Pide tu <em>sello</em><br />aquí</p>
        <div className="poster-qrbox" role="img" aria-label={`Código QR para crear tu tarjeta: ${p.signupUrl}`}
          dangerouslySetInnerHTML={{ __html: p.qrSvg }} />
        <p className="poster-scan">Escanea con la cámara.<br />Sin apps que descargar.</p>
        <div className="poster-reward">
          Junta {p.stampsRequired} sellos y gana
          <strong>{p.rewardTitle}</strong>
        </div>
        <p className="poster-url">{hostPath}</p>
      </article>
    </div>
  );
}
