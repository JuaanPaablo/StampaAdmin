import { NextResponse, type NextRequest } from 'next/server';

/**
 * Un solo dominio público: stampaecu.app. Se redirige (308) conservando la ruta:
 * - app.stampaecu.app (alias viejo);
 * - cualquier *.vercel.app de producción (stampa-admin.vercel.app y similares), para que enlaces viejos, invitaciones
 *   o QR antiguos terminen en el dominio propio. Las vistas previas (VERCEL_ENV=preview) no se tocan.
 */
const MAIN = 'stampaecu.app';
const ALIASES = new Set(['app.stampaecu.app', 'www.stampaecu.app']);

function shouldRedirect(host: string): boolean {
  if (ALIASES.has(host)) return true;
  return process.env.VERCEL_ENV === 'production' && host.endsWith('.vercel.app');
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.toLowerCase().split(':')[0];
  if (host && shouldRedirect(host)) {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    url.host = MAIN;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: '/:path*' };
