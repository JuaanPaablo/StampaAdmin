import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/urls';

/** Solo la landing y las páginas legales se indexan; el panel, el admin y las tarjetas de clientes no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/privacidad', '/terminos'], disallow: ['/panel', '/admin', '/u/', '/mis-tarjetas', '/invitacion', '/restablecer', '/bienvenida', '/suspendido', '/ingresar'] }],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl()
  };
}
