import type { Metadata, Viewport } from 'next';

/** Página pública del cliente: sin indexar y con la barra del navegador en Azul Noche. */
export const metadata: Metadata = {
  title: 'Tu tarjeta · Stampa',
  robots: { index: false, follow: false, nocache: true }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#001D3D' };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
