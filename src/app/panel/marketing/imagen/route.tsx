import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getContext } from '@/lib/context';
import { alpha, contrastRatio, normalizeHex, readableOn } from '@/components/card/contrast';
import { safeImageUrl } from '@/components/card/images';
import { logoInitials } from '@/components/customer/card-model';

/**
 * Imagen de un post (PNG) con la marca del negocio: logo, colores, letra Sora y el premio. Sin IA, sin costo.
 * /panel/marketing/imagen?d=color|foto|claro|numero&f=sq|story&t=título&s=subtítulo&b=cifra&dl=1
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FONT_DIR = path.join(process.cwd(), 'src', 'assets', 'fonts');
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700 | 800 }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(path.join(FONT_DIR, 'Sora-Bold.ttf')).then((data) => ({ name: 'Sora', data, weight: 700 as const })),
    readFile(path.join(FONT_DIR, 'Sora-ExtraBold.ttf')).then((data) => ({ name: 'Sora', data, weight: 800 as const })),
    readFile(path.join(FONT_DIR, 'Inter-Regular.ttf')).then((data) => ({ name: 'Inter', data, weight: 400 as const })),
    readFile(path.join(FONT_DIR, 'Inter-SemiBold.ttf')).then((data) => ({ name: 'Inter', data, weight: 600 as const }))
  ]);
  return fonts;
}

/** Descarga una imagen PNG/JPG y la devuelve como data URL (WEBP no lo soporta el motor de imágenes). */
async function asDataUrl(url: string | undefined): Promise<string | undefined> {
  const safe = safeImageUrl(url);
  if (!safe) return undefined;
  if (safe.startsWith('data:image/png') || safe.startsWith('data:image/jpeg')) return safe;
  if (safe.startsWith('data:')) return undefined;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(safe, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    const type = (res.headers.get('content-type') ?? '').split(';')[0];
    if (!res.ok || !['image/png', 'image/jpeg'].includes(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 3 * 1024 * 1024) return undefined;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

const clean = (v: string | null, max: number) => (v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export async function GET(req: Request) {
  const { business, program, staff } = await getContext();
  if (staff.role === 'cashier') return new Response('Solo dueño y gerente.', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const design = (['color', 'foto', 'claro', 'numero'] as const).find((d) => d === sp.get('d')) ?? 'color';
  const story = sp.get('f') === 'story';
  const W = 1080, H = story ? 1920 : 1080;
  const title = clean(sp.get('t'), 60) || '¡Tu sello te espera!';
  const sub = clean(sp.get('s'), 110);
  const big = clean(sp.get('b'), 10);

  const card = {
    bg: normalizeHex(program.colors?.bg ?? '') ?? '#001D3D',
    accent: normalizeHex(program.colors?.accent ?? '') ?? '#FFC301',
    ink: normalizeHex(program.colors?.ink ?? '') ?? '#FFFFFF'
  };
  const light = design === 'claro';
  const bg = light ? '#F4F7FA' : card.bg;
  const ink = light ? '#001D3D' : contrastRatio(card.ink, card.bg) >= 4.5 ? card.ink : readableOn(card.bg);
  const accent = light ? (contrastRatio(card.accent, '#F4F7FA') >= 3 ? card.accent : '#001D3D') : card.accent;
  const accentInk = readableOn(accent);

  const [logo, cover] = await Promise.all([
    asDataUrl(program.logoUrl || undefined),
    design === 'foto' ? asDataUrl(program.coverUrl || undefined) : Promise.resolve(undefined)
  ]);
  const initials = logoInitials(program.logoText, business.name);
  const ms = (program.milestones ?? []).filter((m) => m.at < program.stampsRequired);
  const rewardLine = `Junta ${program.stampsRequired} sellos y gana ${program.rewardTitle}`;
  const titleSize = title.length <= 18 ? 108 : title.length <= 30 ? 90 : 74;
  const pad = 80;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} width={96} height={96} style={{ borderRadius: 48, objectFit: 'cover', background: '#fff' }} alt="" />
        : <div style={{ width: 96, height: 96, borderRadius: 48, background: accent, color: accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 800, fontSize: 36 }}>{initials}</div>}
      <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 700, fontSize: 40, color: ink, maxWidth: W - pad * 2 - 130 }}>{business.name}</div>
    </div>
  );

  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignSelf: 'flex-start', background: accent, color: accentInk, borderRadius: 999, padding: '18px 34px', fontFamily: 'Inter', fontWeight: 600, fontSize: 32 }}>
        {rewardLine}
      </div>
      {ms.length > 0 && (
        <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: 28, color: alpha(ink, 0.85) }}>
          {'Y en el camino: ' + ms.map((m) => `sello ${m.at}, ${m.title}`).join(' · ')}
        </div>
      )}
      <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: 28, color: alpha(ink, 0.75) }}>Escanea el QR en caja · sin descargar apps</div>
    </div>
  );

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {design === 'numero' && big && (
        <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: big.length <= 4 ? 300 : 220, lineHeight: 1, color: accent, letterSpacing: -8 }}>{big}</div>
      )}
      <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: titleSize, lineHeight: 1.02, letterSpacing: -3, color: ink }}>{title}</div>
      {sub && <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: 40, lineHeight: 1.3, color: alpha(ink, 0.88) }}>{sub}</div>}
    </div>
  );

  const el = design === 'foto' && cover ? (
    <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: bg }}>
      <div style={{ display: 'flex', position: 'relative', width: W, height: Math.round(H * 0.5) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} width={W} height={Math.round(H * 0.5)} style={{ objectFit: 'cover' }} alt="" />
        <div style={{ position: 'absolute', left: pad, top: pad, display: 'flex', background: alpha(bg, 0.85), borderRadius: 999, padding: '14px 28px 14px 14px' }}>{header}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: pad }}>
        {body}
        {footer}
      </div>
    </div>
  ) : (
    <div style={{
      width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, backgroundColor: bg,
      // El motor de imágenes falla con propiedades en undefined: solo se agrega si aplica.
      ...(light ? {} : { backgroundImage: `radial-gradient(circle at 85% 10%, ${alpha(accent, 0.28)} 0%, ${alpha(accent, 0)} 45%)` })
    }}>
      {header}
      {body}
      {footer}
    </div>
  );

  const res = new ImageResponse(el, { width: W, height: H, fonts: await loadFonts() });
  if (sp.get('dl') === '1') {
    const slug = business.slug.replace(/[^a-z0-9-]/gi, '') || 'negocio';
    res.headers.set('Content-Disposition', `attachment; filename="post-${slug}-${story ? 'historia' : 'cuadrado'}.png"`);
  }
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
