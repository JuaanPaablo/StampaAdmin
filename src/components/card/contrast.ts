/** Utilidades de color y contraste WCAG 2.x. Funciones puras, seguras en cliente y servidor. */

export function normalizeHex(v: string): string | null {
  const s = v.trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (m) return '#' + m[1].toUpperCase();
  const short = /^#?([0-9a-fA-F]{3})$/.exec(s);
  if (short) {
    const [r, g, b] = short[1].split('');
    return ('#' + r + r + g + g + b + b).toUpperCase();
  }
  return null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores, de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto oscuro o blanco, el que mejor se lea sobre `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio('#001D3D', bg) >= contrastRatio('#FFFFFF', bg) ? '#001D3D' : '#FFFFFF';
}

export function ratioText(r: number): string {
  return r.toFixed(1).replace('.', ',');
}

export interface Palette { id: string; name: string; bg: string; accent: string; ink: string }

/** Paletas sugeridas. Todas cumplen texto 4,5:1 y acento 3:1 sobre el fondo. */
export const PALETTES: Palette[] = [
  { id: 'noche', name: 'Azul noche', bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF' },
  { id: 'cafe', name: 'Tostado', bg: '#2B1B12', accent: '#D9A86C', ink: '#FFF8EE' },
  { id: 'bosque', name: 'Bosque', bg: '#0F3D2E', accent: '#5BD69B', ink: '#F4FFF9' },
  { id: 'ciruela', name: 'Ciruela', bg: '#2D1B3D', accent: '#C9A7F5', ink: '#FFFFFF' },
  { id: 'coral', name: 'Coral suave', bg: '#FFF1EC', accent: '#C2410C', ink: '#3A1F17' },
  { id: 'claro', name: 'Blanco y azul', bg: '#FFFFFF', accent: '#013565', ink: '#001D3D' }
];
