import { Isotype } from './StampGrid';
import { alpha, normalizeHex, readableOn } from './contrast';

export type PosterSize = 'a4' | 'a6';

export interface PosterProps {
  businessName: string;
  logoText: string;
  logoUrl?: string;
  colors: { bg: string; accent: string; ink: string };
  slogan: string;
  signupUrl: string;
  qrSvg: string;
  steps: [string, string, string];
  rewardTitle: string;
  stampsRequired: number;
  size: PosterSize;
}

/** CSS del póster. Todo se mide en cqw (porcentaje del ancho de la hoja) para que A4 y A6 compartan diseño. */
export function posterCss(size: PosterSize): string {
  const dims = size === 'a6' ? { w: '105mm', h: '148mm', page: 'A6' } : { w: '210mm', h: '297mm', page: 'A4' };
  return `
.poster-wrap{display:flex;justify-content:center}
.poster-sheet{container-type:inline-size;width:100%;max-width:${dims.w};aspect-ratio:${size === 'a6' ? '105 / 148' : '210 / 297'};background:#fff;color:#001D3D;box-shadow:0 10px 30px rgba(0,29,61,.15);overflow:hidden;position:relative;display:flex;flex-direction:column;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.poster-head{padding:5cqw 8cqw 4cqw;display:flex;align-items:center;gap:4cqw}
.poster-logo{width:11cqw;height:11cqw;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:5cqw;overflow:hidden;flex:none;font-family:Sora,Inter,system-ui,sans-serif}
.poster-logo img{width:100%;height:100%;object-fit:cover}
.poster-name{font-family:Sora,Inter,system-ui,sans-serif;font-weight:700;font-size:5.4cqw;line-height:1.1;overflow-wrap:anywhere}
.poster-slogan{font-family:Sora,Inter,system-ui,sans-serif;font-weight:700;font-size:6.6cqw;line-height:1.05;text-align:center;margin:4cqw 8cqw 0}
.poster-qrbox{margin:3.5cqw auto 0;width:42cqw;height:42cqw;padding:2.5cqw;background:#fff;border-radius:4cqw}
.poster-qrbox svg{display:block;width:100%;height:100%}
.poster-url{text-align:center;font-size:2.6cqw;margin-top:2.2cqw;color:#4A6380;word-break:break-all;padding:0 8cqw}
.poster-steps{list-style:none;margin:3.5cqw 8cqw 0;padding:0;display:grid;gap:2cqw}
.poster-steps li{display:flex;align-items:center;gap:3cqw;font-size:3.4cqw;line-height:1.2;font-weight:600}
.poster-steps .n{width:6.2cqw;height:6.2cqw;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:3.6cqw;flex:none}
.poster-reward{margin:3cqw 8cqw 0;border-radius:3cqw;padding:3cqw 4cqw;font-size:3.4cqw;line-height:1.25;text-align:center}
.poster-reward strong{display:block;font-family:Sora,Inter,system-ui,sans-serif;font-size:4.6cqw;margin-top:.6cqw}
.poster-foot{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:2cqw;padding:3.5cqw 0;font-size:3cqw;font-weight:600}
.poster-foot svg{width:5cqw;height:5cqw}
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
  const bg = normalizeHex(p.colors.bg) ?? '#001D3D';
  const accent = normalizeHex(p.colors.accent) ?? '#FFC301';
  const ink = normalizeHex(p.colors.ink) ?? '#FFFFFF';
  const hostPath = p.signupUrl.replace(/^https?:\/\//, '');
  return (
    <div className="poster-wrap">
      <style dangerouslySetInnerHTML={{ __html: posterCss(p.size) }} />
      <article className="poster-sheet" aria-label={`Póster de ${p.businessName}, tamaño ${p.size.toUpperCase()}`}>
        <header className="poster-head" style={{ background: bg, color: ink }}>
          <span className="poster-logo" style={{ background: accent, color: readableOn(accent) }} aria-hidden="true">
            {p.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.logoUrl} alt="" referrerPolicy="no-referrer" />
              : p.logoText.slice(0, 3).toUpperCase()}
          </span>
          <h2 className="poster-name">{p.businessName}</h2>
        </header>
        <p className="poster-slogan">{p.slogan}</p>
        <div className="poster-qrbox" style={{ border: `1.2cqw solid ${bg}` }} role="img" aria-label={`Código QR para unirse: ${p.signupUrl}`}
          dangerouslySetInnerHTML={{ __html: p.qrSvg }} />
        <p className="poster-url">{hostPath}</p>
        <ol className="poster-steps">
          {p.steps.map((s, i) => (
            <li key={i}><span className="n" style={{ background: bg, color: ink }}>{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
        <div className="poster-reward" style={{ background: alpha(accent, 0.22), border: `0.5cqw solid ${accent}` }}>
          Junta {p.stampsRequired} sellos y gana
          <strong>{p.rewardTitle}</strong>
        </div>
        <footer className="poster-foot" style={{ color: '#4A6380' }}>
          <Isotype color="#001D3D" /> con Stampa
        </footer>
      </article>
    </div>
  );
}
