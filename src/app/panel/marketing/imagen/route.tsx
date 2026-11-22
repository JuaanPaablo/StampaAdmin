import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getContext } from '@/lib/context';
import { alpha, contrastRatio, normalizeHex, readableOn } from '@/components/card/contrast';
import { safeImageUrl } from '@/components/card/images';
import { logoInitials } from '@/components/customer/card-model';
import { PHOTO_DESIGNS, PHOTO_ID_RE, PLAIN_DESIGNS, type PostDesign } from '@/lib/marketing/photos';

/**
 * Imagen de un post (PNG) con la marca del negocio. Sin costo: se dibuja aquí con next/og (satori).
 *
 * /panel/marketing/imagen?d=<diseño>&f=sq|story&t=título&s=subtítulo&b=cifra&ph=<foto>&dl=1
 *   - Con foto (ph = id de una foto de Marketing o "portada"): impacto, marco, dividido, limpio.
 *   - Sin foto: color, claro, numero.
 *
 * Nota: en Windows `next dev` falla al cargar la letra por defecto de next/og (bug de rutas de Next 14). En Vercel
 * (Linux) funciona. Para probar en local usa WSL o un preview de Vercel.
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

/** Descarga una imagen PNG/JPG y la devuelve como data URL (el motor no soporta WEBP). */
async function asDataUrl(url: string | undefined | null): Promise<string | undefined> {
  const safe = safeImageUrl(url ?? undefined);
  if (!safe) return undefined;
  if (safe.startsWith('data:image/png') || safe.startsWith('data:image/jpeg')) return safe;
  if (safe.startsWith('data:')) return undefined;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(safe, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    const type = (res.headers.get('content-type') ?? '').split(';')[0];
    if (!res.ok || !['image/png', 'image/jpeg'].includes(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 7 * 1024 * 1024) return undefined;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

const clean = (v: string | null, max: number) => (v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export async function GET(req: Request) {
  const { repo, business, program, staff } = await getContext();
  if (staff.role === 'cashier') return new Response('Solo dueño y gerente.', { status: 403 });

  const sp = new URL(req.url).searchParams;
  const story = sp.get('f') === 'story';
  const W = 1080, H = story ? 1920 : 1080;
  const title = clean(sp.get('t'), 60) || '¡Tu sello te espera!';
  const sub = clean(sp.get('s'), 110);
  const big = clean(sp.get('b'), 10);

  // Foto: solo fotos del propio negocio (id validado) o su portada. Nunca una URL arbitraria (evita SSRF).
  const ph = sp.get('ph') ?? '';
  const photoUrl = ph === 'portada' ? program.coverUrl : PHOTO_ID_RE.test(ph) ? await repo.marketingPhotoUrl(business.id, ph) : null;
  const [photo, logo] = await Promise.all([asDataUrl(photoUrl), asDataUrl(program.logoUrl)]);

  const requested = sp.get('d') ?? '';
  const design: PostDesign = photo
    ? ((PHOTO_DESIGNS as readonly string[]).includes(requested) ? requested as PostDesign : 'impacto')
    : ((PLAIN_DESIGNS as readonly string[]).includes(requested) ? requested as PostDesign : 'color');

  const card = {
    bg: normalizeHex(program.colors?.bg ?? '') ?? '#001D3D',
    accent: normalizeHex(program.colors?.accent ?? '') ?? '#FFC301',
    ink: normalizeHex(program.colors?.ink ?? '') ?? '#FFFFFF'
  };
  const brandInk = contrastRatio(card.ink, card.bg) >= 4.5 ? card.ink : readableOn(card.bg);
  const accentInk = readableOn(card.accent);
  const initials = logoInitials(program.logoText, business.name);
  const reward = `${program.stampsRequired} sellos = ${program.rewardTitle}`;
  const pad = 72;
  const titleSize = (base: number) => (title.length <= 16 ? base : title.length <= 28 ? Math.round(base * 0.82) : Math.round(base * 0.66));

  const logoEl = (size: number, ring?: string) => logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logo} width={size} height={size} style={{ borderRadius: size / 2, objectFit: 'cover', background: '#fff', ...(ring ? { border: `4px solid ${ring}` } : {}) }} alt="" />
    : <div style={{ width: size, height: size, borderRadius: size / 2, background: card.accent, color: accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora', fontWeight: 800, fontSize: Math.round(size * 0.38) }}>{initials}</div>;

  const brandEl = (ink: string, size = 88, shadow = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      {logoEl(size)}
      <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 700, fontSize: Math.round(size * 0.42), color: ink, maxWidth: W - pad * 2 - size - 40, ...(shadow ? { textShadow: '0 2px 12px rgba(0,0,0,0.6)' } : {}) }}>{business.name}</div>
    </div>
  );

  const chipEl = (size = 30, bg = card.accent, ink = accentInk) => (
    <div style={{ display: 'flex', alignSelf: 'flex-start', background: bg, color: ink, borderRadius: 999, padding: `${Math.round(size * 0.5)}px ${size}px`, fontFamily: 'Inter', fontWeight: 600, fontSize: size }}>
      {reward}
    </div>
  );

  // Las sombras de texto solo se agregan si hacen falta: el motor falla con propiedades en undefined.
  const titleEl = (ink: string, base: number, shadow = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: titleSize(base), lineHeight: 1.04, letterSpacing: -2, color: ink, ...(shadow ? { textShadow: '0 2px 18px rgba(0,0,0,0.45)' } : {}) }}>{title}</div>
      {sub ? <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: Math.round(base * 0.36), lineHeight: 1.3, color: alpha(ink, 0.9), ...(shadow ? { textShadow: '0 1px 10px rgba(0,0,0,0.5)' } : {}) }}>{sub}</div> : null}
    </div>
  );

  // eslint-disable-next-line @next/next/no-img-element
  const photoEl = (w: number, h: number, radius = 0) => <img src={photo!} width={w} height={h} style={{ objectFit: 'cover', borderRadius: radius }} alt="" />;

  let el: JSX.Element;
  if (design === 'impacto') {
    // Foto a sangre completa, degradado oscuro abajo, título grande en blanco.
    el = (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#000' }}>
        {photoEl(W, H)}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 14%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.85) 100%)' }} />
        <div style={{ position: 'absolute', left: pad, top: pad, display: 'flex' }}>{brandEl('#FFFFFF', 80, true)}</div>
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: story ? 220 : pad, display: 'flex', flexDirection: 'column', gap: 30 }}>
          {titleEl('#FFFFFF', story ? 120 : 104, true)}
          {chipEl()}
        </div>
      </div>
    );
  } else if (design === 'marco') {
    // Foto con bordes redondeados sobre el color de la marca; texto debajo.
    const photoH = story ? 1080 : 600;
    el = (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: card.bg, padding: pad, gap: 40, justifyContent: story ? 'center' : 'flex-start' }}>
        {brandEl(brandInk, 72)}
        {photoEl(W - pad * 2, photoH, 36)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {titleEl(brandInk, story ? 92 : 64)}
          {chipEl(26)}
        </div>
      </div>
    );
  } else if (design === 'dividido') {
    // Foto arriba, bloque de color de la marca abajo con el mensaje.
    const photoH = Math.round(H * (story ? 0.58 : 0.55));
    el = (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: card.bg }}>
        <div style={{ display: 'flex', width: W, height: photoH }}>{photoEl(W, photoH)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: pad }}>
          {titleEl(brandInk, story ? 100 : 76)}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            {chipEl(26)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {logoEl(56)}
              <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 700, fontSize: 26, color: alpha(brandInk, 0.9) }}>{business.name}</div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (design === 'limpio') {
    // Casi solo la foto: logo pequeño y una etiqueta con el título. Para fotos que ya lucen por sí solas.
    el = (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#000' }}>
        {photoEl(W, H)}
        <div style={{ position: 'absolute', left: pad, top: pad, display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: '10px 26px 10px 10px' }}>
          {logoEl(60)}
          <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 700, fontSize: 28, color: '#001D3D' }}>{business.name}</div>
        </div>
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: story ? 220 : pad, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', background: card.bg, color: brandInk, borderRadius: 28, padding: '22px 34px', fontFamily: 'Sora', fontWeight: 800, fontSize: titleSize(64), lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
          {chipEl(26)}
        </div>
      </div>
    );
  } else {
    // Sin foto: color de la marca, claro o cifra grande.
    const light = design === 'claro';
    const bg = light ? '#F4F7FA' : card.bg;
    const ink = light ? '#001D3D' : brandInk;
    const accent = light ? (contrastRatio(card.accent, '#F4F7FA') >= 3 ? card.accent : '#001D3D') : card.accent;
    el = (
      <div style={{
        width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, backgroundColor: bg,
        ...(light ? {} : { backgroundImage: `radial-gradient(circle at 85% 10%, ${alpha(accent, 0.3)} 0%, ${alpha(accent, 0)} 50%)` })
      }}>
        {brandEl(ink)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {design === 'numero' && big ? (
            <div style={{ display: 'flex', fontFamily: 'Sora', fontWeight: 800, fontSize: big.length <= 4 ? 320 : 230, lineHeight: 1, color: accent, letterSpacing: -10 }}>{big}</div>
          ) : null}
          {titleEl(ink, story ? 120 : 104)}
        </div>
        {chipEl(30, accent, readableOn(accent))}
      </div>
    );
  }

  const res = new ImageResponse(el, { width: W, height: H, fonts: await loadFonts() });
  if (sp.get('dl') === '1') {
    const slug = business.slug.replace(/[^a-z0-9-]/gi, '') || 'negocio';
    res.headers.set('Content-Disposition', `attachment; filename="post-${slug}-${story ? 'historia' : 'cuadrado'}.png"`);
  }
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
