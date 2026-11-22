import { NextResponse, type NextRequest } from 'next/server';

/** app.stampaecu.app es un alias viejo: todo se redirige (308) al dominio principal conservando la ruta. */
const ALIASES = new Set(['app.stampaecu.app']);
const MAIN = 'stampaecu.app';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.toLowerCase().split(':')[0];
  if (host && ALIASES.has(host)) {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    url.host = MAIN;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: '/:path*' };
