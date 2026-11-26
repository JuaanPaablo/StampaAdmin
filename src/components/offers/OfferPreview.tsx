/* eslint-disable @next/next/no-img-element -- la imagen del cupón es un enlace externo que pega el dueño */

/** Cómo se ve el cupón en el celular del cliente (aproximado). Sin estado: sirve en servidor y en cliente. */
export function OfferPreview({ businessName, logoText, logoUrl, colors, title, description, terms, imageUrl, validity }: {
  businessName: string;
  logoText: string;
  logoUrl?: string;
  colors: { bg: string; accent: string; ink: string };
  title: string;
  description: string;
  terms?: string;
  imageUrl?: string;
  validity: string;
}) {
  const showImage = !!imageUrl && /^https:\/\/\S+$/i.test(imageUrl);
  return (
    <figure className="mx-auto w-full max-w-[340px]" aria-label="Vista previa del cupón">
      <div className="overflow-hidden rounded-[22px] shadow-card ring-1 ring-black/5" style={{ background: colors.bg, color: colors.ink }}>
        <div className="flex items-center gap-2.5 px-4 pt-4">
          {logoUrl
            ? <img src={logoUrl} alt="" className="size-9 rounded-full bg-white object-cover" />
            : <span aria-hidden="true" className="grid size-9 place-items-center rounded-full text-xs font-bold" style={{ background: colors.accent, color: colors.bg }}>{logoText.slice(0, 3)}</span>}
          <span className="min-w-0 truncate text-sm font-semibold">{businessName}</span>
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: colors.accent, color: colors.bg }}>Cupón</span>
        </div>
        {showImage && <img src={imageUrl} alt="" className="mt-3 aspect-[3/1] w-full object-cover" />}
        <div className="px-4 pb-4 pt-3">
          <p className="break-words font-display text-xl font-bold leading-tight">{title || 'Título del cupón'}</p>
          <p className="mt-1.5 break-words text-sm opacity-90">{description || 'Qué incluye el cupón.'}</p>
          <p className="mt-3 text-xs font-semibold opacity-80">{validity}</p>
          <div className="mt-4 grid place-items-center rounded-xl bg-white p-3">
            <svg viewBox="0 0 21 21" className="size-24" aria-hidden="true" shapeRendering="crispEdges">
              {QR_DOTS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#001D3D" />)}
            </svg>
            <p className="mt-1 text-[10px] text-[#4A5D73]">Se muestra en caja para usarlo una vez</p>
          </div>
          {terms && <p className="mt-3 break-words text-[11px] opacity-75">{terms}</p>}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">Así lo verán tus clientes (aproximado).</figcaption>
    </figure>
  );
}

/** Patrón fijo tipo QR solo decorativo (la vista previa no codifica nada). */
const QR_DOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  const finder = (ox: number, oy: number) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const edge = i === 0 || j === 0 || i === 6 || j === 6;
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      if (edge || core) out.push([ox + i, oy + j]);
    }
  };
  finder(0, 0); finder(14, 0); finder(0, 14);
  let seed = 7;
  for (let x = 0; x < 21; x++) for (let y = 0; y < 21; y++) {
    const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    if (!inFinder && seed % 3 === 0) out.push([x, y]);
  }
  return out;
})();
