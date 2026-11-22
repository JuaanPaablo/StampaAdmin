import type { CSSProperties } from 'react';
import type { Customer, ImageFraming, Milestone, Program } from './contracts';

/** Premios de la tarjeta (intermedios y final) y encuadre de imágenes. Sin dependencias de Node: también corre en el navegador. */

export const MAX_MILESTONES = 3;

/**
 * Pone en minúscula la primera letra solo si la palabra es "Normal" ("Café gratis" → "café gratis").
 * Respeta mayúsculas sostenidas y siglas: "LIMONADA" y "BBQ gratis" quedan igual.
 */
export function lcfirst(s: string): string {
  if (!s) return s;
  const first = s.charAt(0);
  const second = s.charAt(1);
  if (second && second === second.toUpperCase() && second !== second.toLowerCase()) return s;
  return first.toLowerCase() + s.slice(1);
}

/** Premios intermedios válidos para una tarjeta de `total` sellos, ordenados. */
export function cleanMilestones(list: Milestone[] | undefined, total: number): Milestone[] {
  const seen = new Set<number>();
  return (list ?? [])
    .filter((m) => Number.isInteger(m.at) && m.at >= 1 && m.at < total && m.title?.trim())
    .filter((m) => (seen.has(m.at) ? false : (seen.add(m.at), true)))
    .map((m) => ({ at: m.at, title: m.title.trim().slice(0, 50) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_MILESTONES);
}

/** Error en español o null. */
export function validateMilestones(list: Milestone[], total: number, max: number = MAX_MILESTONES): string | null {
  if (list.length > max) return max === 1 ? 'Tu plan permite 1 premio antes del final.' : `Puedes dar hasta ${max} premios antes del final.`;
  const seen = new Set<number>();
  for (const m of list) {
    if (!Number.isInteger(m.at) || m.at < 1 || m.at >= total) return `Cada premio intermedio debe ir antes del sello ${total}.`;
    if (seen.has(m.at)) return `Ya hay un premio en el sello ${m.at}.`;
    seen.add(m.at);
    const t = (m.title ?? '').trim();
    if (t.length < 2) return `Escribe el premio del sello ${m.at}.`;
    if (t.length > 50) return `El premio del sello ${m.at} es muy largo (máximo 50 letras).`;
  }
  return null;
}

export interface PendingReward { milestone?: number; title: string }

/** Premios que el cliente ya puede canjear: los intermedios alcanzados y no canjeados, y el final. */
export function pendingRewards(c: Pick<Customer, 'stamps' | 'milestonesClaimed'>, p: Pick<Program, 'stampsRequired' | 'rewardTitle' | 'milestones'>): PendingReward[] {
  const claimed = new Set(c.milestonesClaimed ?? []);
  const out: PendingReward[] = cleanMilestones(p.milestones, p.stampsRequired)
    .filter((m) => c.stamps >= m.at && !claimed.has(m.at))
    .map((m) => ({ milestone: m.at, title: m.title }));
  if (c.stamps >= p.stampsRequired) out.push({ title: p.rewardTitle });
  return out;
}

/** El próximo premio por alcanzar (intermedio o final). */
export function nextReward(stamps: number, p: Pick<Program, 'stampsRequired' | 'rewardTitle' | 'milestones'>): { at: number; title: string } {
  const m = cleanMilestones(p.milestones, p.stampsRequired).find((x) => x.at > stamps);
  return m ?? { at: p.stampsRequired, title: p.rewardTitle };
}

/** Sello → título del premio intermedio (para marcar los casilleros). */
export function milestoneMap(p: Pick<Program, 'stampsRequired' | 'milestones'>): Map<number, string> {
  return new Map(cleanMilestones(p.milestones, p.stampsRequired).map((m) => [m.at, m.title]));
}

/* ---------- Encuadre de imágenes ---------- */

export const DEFAULT_FRAMING: ImageFraming = { x: 50, y: 50, zoom: 1 };

export function cleanFraming(f: Partial<ImageFraming> | undefined): ImageFraming {
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return { x: Math.round(n(f?.x, 0, 100, 50)), y: Math.round(n(f?.y, 0, 100, 50)), zoom: Math.round(n(f?.zoom, 1, 3, 1) * 100) / 100 };
}

/** Estilo de un <img object-cover> con el encuadre guardado. */
export function framingStyle(f: Partial<ImageFraming> | undefined): CSSProperties {
  const c = cleanFraming(f);
  const pos = `${c.x}% ${c.y}%`;
  return c.zoom > 1 ? { objectPosition: pos, transform: `scale(${c.zoom})`, transformOrigin: pos } : { objectPosition: pos };
}
