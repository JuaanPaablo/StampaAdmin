/**
 * true si la petición NO viene de otro sitio: sin `Sec-Fetch-Site` (navegadores viejos, iOS al abrir un enlace) o con
 * `same-origin` / `none` (escrita a mano o desde un marcador). Las descargas de Wallet son GET con sesión: un sitio ajeno
 * podría dispararlas con un <img> o un enlace, así que solo se GUARDAN datos (setCustomerWallet) cuando esto es true.
 */
export function sameSiteNavigation(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}
