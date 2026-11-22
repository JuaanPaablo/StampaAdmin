import type { CSSProperties } from 'react';
import { Isotipo } from '@/components/shell/logo';
import type { ImageFraming, PosterFont, PosterStyle, PosterTheme } from '@/lib/contracts';
import { framingStyle } from '@/lib/rewards';
import { normalizeHex, readableOn } from './contrast';
import { safeImageUrl } from './images';

export type PosterSize = 'a4' | 'a6';

export interface PosterProps {
  businessName: string;
  logoText: string;
  logoUrl?: string;
  logoFraming?: Partial<ImageFraming>;
  /** Colores de la tarjeta (tema "tarjeta" y círculo del logo sin imagen). */
  colors: { bg: string; accent: string; ink: string };
  /** Dirección pública que codifica el QR (customerUrl(slug)). */
  signupUrl: string;
  qrSvg: string;
  rewardTitle: string;
  stampsRequired: number;
  size: PosterSize;
  design?: PosterStyle;
}

export const POSTER_THEMES: { id: PosterTheme; label: string }[] = [
  { id: 'stampa', label: 'Stampa' },
  { id: 'tarjeta', label: 'Colores de tu tarjeta' },
  { id: 'claro', label: 'Claro' },
  { id: 'sol', label: 'Amarillo' },
  { id: 'personal', label: 'Personalizado' }
];

export const POSTER_FONTS: { id: PosterFont; label: string; family: string; google: string }[] = [
  { id: 'sora', label: 'Moderna', family: 'Sora', google: 'Sora:wght@600;700;800' },
  { id: 'redonda', label: 'Redondeada', family: 'Nunito', google: 'Nunito:wght@700;800;900' },
  { id: 'clasica', label: 'Clásica', family: 'Playfair Display', google: 'Playfair+Display:wght@700;800;900' },
  { id: 'impacto', label: 'Impacto', family: 'Bebas Neue', google: 'Bebas+Neue' },
  { id: 'manuscrita', label: 'Manuscrita', family: 'Pacifico', google: 'Pacifico' }
];

/** Hoja de estilos de Google Fonts con todas las letras del póster. */
export const POSTER_FONTS_HREF = `https://fonts.googleapis.com/css2?${POSTER_FONTS.filter((f) => f.id !== 'sora').map((f) => `family=${f.google}`).join('&')}&display=swap`;

export const DEFAULT_POSTER_TITLE = 'Pide tu sello aquí';

/** Colores efectivos del póster según el tema. */
export function posterPalette(design: PosterStyle | undefined, card: { bg: string; accent: string; ink: string }) {
  const theme = design?.theme ?? 'stampa';
  const hex = (v: string | undefined, d: string) => normalizeHex(v ?? '') ?? d;
  switch (theme) {
    case 'tarjeta': return { bg: hex(card.bg, '#001D3D'), accent: hex(card.accent, '#FFC301'), ink: hex(card.ink, '#FFFFFF'), gradient: false };
    case 'claro': return { bg: '#F4F7FA', accent: '#B07A00', ink: '#001D3D', gradient: false };
    case 'sol': return { bg: '#FFC301', accent: '#001D3D', ink: '#001D3D', gradient: false };
    case 'personal': return { bg: hex(design?.bg, '#001D3D'), accent: hex(design?.accent, '#FFC301'), ink: hex(design?.ink, '#FFFFFF'), gradient: false };
    default: return { bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF', gradient: true };
  }
}

/**
 * CSS del póster (manual de marca, 6.3). Los colores y la letra llegan como variables (--p-*) para que cada negocio lo
 * personalice. Todo se mide en cqw (porcentaje del ancho de la hoja) para que A4 y A6 compartan diseño.
 */
export function posterCss(size: PosterSize): string {
  const dims = size === 'a6' ? { w: '105mm', h: '148mm', page: 'A6' } : { w: '210mm', h: '297mm', page: 'A4' };
  return `
.poster-wrap{display:flex;justify-content:center}
.poster-sheet{container-type:inline-size;width:100%;max-width:${dims.w};aspect-ratio:${size === 'a6' ? '105 / 148' : '210 / 297'};background:var(--p-bg);color:var(--p-ink);box-shadow:0 10px 30px rgba(0,29,61,.25);overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:Inter,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.poster-sheet.is-gradient{background:linear-gradient(160deg,#013565 0%,#001D3D 55%)}
.poster-brand{display:flex;align-items:center;gap:1.6cqw;margin-top:6cqw;font-family:Sora,Inter,system-ui,sans-serif;font-weight:700;font-size:4.2cqw;letter-spacing:-.02em}
.poster-brand svg{width:5.2cqw;height:5.2cqw}
.poster-biz{display:flex;flex-direction:column;align-items:center;gap:2.4cqw;margin-top:6cqw;padding:0 8cqw}
.poster-logo{width:17cqw;height:17cqw;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:6.4cqw;overflow:hidden;flex:none;font-family:Sora,Inter,system-ui,sans-serif;box-shadow:0 0 0 1cqw color-mix(in srgb,var(--p-ink) 14%,transparent)}
.poster-logo img{width:100%;height:100%;object-fit:cover;background:#fff}
.poster-name{font-family:var(--p-font);font-weight:700;font-size:4.6cqw;line-height:1.15;overflow-wrap:anywhere;margin:0}
.poster-title{font-family:var(--p-font);font-weight:800;font-size:10.5cqw;line-height:1.05;letter-spacing:-.03em;margin:5cqw 6cqw 0;overflow-wrap:anywhere}
.poster-title em{font-style:normal;color:var(--p-accent)}
.poster-sheet[data-font="impacto"] .poster-title{font-size:15cqw;letter-spacing:.01em;font-weight:400;line-height:.95}
.poster-sheet[data-font="impacto"] .poster-name{font-weight:400;font-size:6cqw;letter-spacing:.02em}
.poster-sheet[data-font="manuscrita"] .poster-title{font-weight:400;font-size:9.5cqw;letter-spacing:0;line-height:1.25}
.poster-sheet[data-font="manuscrita"] .poster-name{font-weight:400}
.poster-qrbox{margin:6cqw auto 0;width:46cqw;height:46cqw;padding:3cqw;background:#fff;border-radius:4.5cqw;box-shadow:0 0 0 .8cqw color-mix(in srgb,var(--p-accent) 55%,transparent)}
.poster-qrbox svg{display:block;width:100%;height:100%}
.poster-scan{margin:4cqw 8cqw 0;font-size:3.3cqw;line-height:1.45;color:color-mix(in srgb,var(--p-ink) 80%,transparent)}
.poster-reward{margin:5cqw 8cqw 0;border-radius:3cqw;padding:2.8cqw 5cqw;font-size:3.2cqw;line-height:1.3;background:color-mix(in srgb,var(--p-ink) 9%,transparent)}
.poster-reward strong{display:block;font-family:var(--p-font);font-size:4.4cqw;margin-top:.6cqw;color:var(--p-ink)}
.poster-url{margin-top:auto;padding:0 6cqw 6.5cqw;font-family:Sora,Inter,system-ui,sans-serif;font-weight:700;font-size:3.6cqw;color:var(--p-accent);word-break:break-all}
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
  const pal = posterPalette(p.design, p.colors);
  const cardAccent = normalizeHex(p.colors.accent) ?? '#FFC301';
  const logo = safeImageUrl(p.logoUrl);
  const hostPath = p.signupUrl.replace(/^https?:\/\//, '');
  const fontId = p.design?.font ?? 'sora';
  const font = POSTER_FONTS.find((f) => f.id === fontId) ?? POSTER_FONTS[0];
  const custom = p.design?.title?.trim();
  const showReward = p.design?.showReward !== false;
  const vars = { '--p-bg': pal.bg, '--p-ink': pal.ink, '--p-accent': pal.accent, '--p-font': `'${font.family}',Sora,Inter,system-ui,sans-serif` } as CSSProperties;
  return (
    <div className="poster-wrap">
      <style dangerouslySetInnerHTML={{ __html: posterCss(p.size) }} />
      <article className={'poster-sheet' + (pal.gradient ? ' is-gradient' : '')} data-font={fontId} style={vars} aria-label={`Póster de ${p.businessName}, tamaño ${p.size.toUpperCase()}`}>
        <div className="poster-brand">
          <Isotipo size={20} color={pal.ink} dot={pal.accent} /> <span aria-hidden="true">stampa</span>
        </div>
        <div className="poster-biz">
          <span className="poster-logo" style={logo ? undefined : { background: cardAccent, color: readableOn(cardAccent) }} aria-hidden="true">
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt="" referrerPolicy="no-referrer" style={framingStyle(p.logoFraming)} />
              : (p.logoText || p.businessName).slice(0, 3).toUpperCase()}
          </span>
          <h2 className="poster-name">{p.businessName}</h2>
        </div>
        <p className="poster-title">{custom ? custom : <>Pide tu <em>sello</em><br />aquí</>}</p>
        <div className="poster-qrbox" role="img" aria-label={`Código QR para crear tu tarjeta: ${p.signupUrl}`}
          dangerouslySetInnerHTML={{ __html: p.qrSvg }} />
        <p className="poster-scan">Escanea con la cámara.<br />Sin apps que descargar.</p>
        {showReward && (
          <div className="poster-reward">
            Junta {p.stampsRequired} sellos y gana
            <strong>{p.rewardTitle}</strong>
          </div>
        )}
        <p className="poster-url">{hostPath}</p>
      </article>
    </div>
  );
}
