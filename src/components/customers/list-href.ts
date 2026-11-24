import { SEGMENT_KEYS, SORTS } from './segments';

export type ListParams = { q?: string; segmento?: string; orden?: string; pagina?: number };

/** URL de la lista de clientes (o de la exportación) con solo los filtros que no son los de por defecto. */
export function listHref(p: ListParams, base = '/panel/clientes'): string {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  if (p.segmento && p.segmento !== 'todos') u.set('segmento', p.segmento);
  if (p.orden && p.orden !== 'recientes') u.set('orden', p.orden);
  if (p.pagina && p.pagina > 1) u.set('pagina', String(p.pagina));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

/** Enlace a la ficha que recuerda la búsqueda y los filtros para volver al mismo punto de la lista. */
export function detailHref(id: string, p: ListParams): string {
  const qs = listHref(p).split('?')[1];
  return `/panel/clientes/${id}` + (qs ? `?volver=${encodeURIComponent(qs)}` : '');
}

/** Reconstruye la vuelta a la lista desde ?volver=, aceptando solo filtros conocidos (nunca otra ruta). */
export function backHref(raw?: string): string {
  if (!raw) return '/panel/clientes';
  const sp = new URLSearchParams(raw);
  const seg = sp.get('segmento') ?? '';
  const ord = sp.get('orden') ?? '';
  const pag = Math.floor(Number(sp.get('pagina')));
  return listHref({
    q: (sp.get('q') ?? '').trim().slice(0, 80) || undefined,
    segmento: (SEGMENT_KEYS as string[]).includes(seg) ? seg : undefined,
    orden: SORTS.some((s) => s.key === ord) ? ord : undefined,
    pagina: Number.isFinite(pag) && pag > 1 ? pag : undefined
  });
}
