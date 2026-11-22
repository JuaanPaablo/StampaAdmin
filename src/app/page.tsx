import type { Metadata } from 'next';
import '@/components/landing/landing.css';
import { LandingFx, THEME_SCRIPT, ThemeToggle } from '@/components/landing/LandingFx';
import type { Plan } from '@/lib/contracts';
import { PLAN_FEATURES, PLAN_LABEL } from '@/lib/plans';
import { appUrl, stampaWhatsappUrl, STAMPA_WHATSAPP_DISPLAY } from '@/lib/urls';

/**
 * Landing de ventas (stampaecu.app). Servidor puro salvo LandingFx (animaciones) y ThemeToggle.
 * Los precios salen de PLAN_FEATURES: cambiar un plan en la app lo cambia aquí.
 * SEO/AEO: metadatos, Open Graph, datos estructurados (Organization, SoftwareApplication con ofertas y FAQPage).
 */

const TITLE = 'Stampa · Tarjeta de sellos digital para tu negocio en Ecuador';
const DESC = 'Tarjeta de cliente frecuente digital para restaurantes, cafeterías, barberías y gimnasios. Tus clientes escanean un QR, la guardan en Apple o Google Wallet y reciben avisos cuando pasan cerca. Sin apps.';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: TITLE,
  description: DESC,
  keywords: ['tarjeta de sellos digital', 'programa de fidelización', 'cliente frecuente', 'tarjeta de lealtad', 'Apple Wallet', 'Google Wallet', 'restaurantes Ecuador', 'fidelizar clientes', 'marketing con IA'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'es_EC', url: '/', siteName: 'Stampa', title: TITLE, description: DESC, images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Stampa, tarjeta de sellos digital' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/og.png'] },
  robots: { index: true, follow: true }
};

const WA = (t: string) => stampaWhatsappUrl(t);

const FAQ: { q: string; a: string }[] = [
  { q: '¿Mis clientes tienen que descargar una app?', a: 'No. Escanean el QR de tu local con la cámara, se registran en segundos con su nombre y correo, y guardan la tarjeta en Apple Wallet o Google Wallet. También pueden abrirla desde el navegador.' },
  { q: '¿Cómo funcionan las notificaciones por cercanía?', a: 'Cuando la tarjeta está en Apple o Google Wallet, el teléfono de tu cliente muestra un aviso al pasar cerca de una de tus sucursales, por ejemplo: "Estás cerca, te falta 1 sello para tu premio". Disponible en los planes Standard y Pro.' },
  { q: '¿Cómo se evita que se regalen sellos?', a: 'Cada sello sale de un código de un solo uso que genera la caja para una compra real, con monto mínimo, vencimiento en minutos y tiempo de espera entre sellos. Si alguien intenta repetir un ticket o usar un código vencido, te llega una alerta.' },
  { q: '¿Sirve para varias sucursales?', a: 'Sí. Standard incluye hasta 3 sucursales y Pro hasta 10. Ves las visitas de todas en un mismo panel y cada persona de tu equipo tiene su usuario y su rol: dueño, gerente o caja.' },
  { q: '¿Qué hace la IA de marketing?', a: 'Te propone ideas de posts con los datos reales de tu negocio (tu día más flojo, tu hora pico, los premios entregados), escribe los textos para Instagram, Facebook o WhatsApp y mejora las fotos de tus productos sin inventarlos.' },
  { q: '¿Cuánto cuesta y cómo pago?', a: 'Desde $29,99 al mes con IVA incluido, sin contratos: cambias o cancelas cuando quieras. Escríbenos por WhatsApp, elegimos tu plan y te llega el acceso a tu correo.' },
  { q: '¿En cuánto tiempo está lista?', a: 'En unos minutos: subes tu logo, eliges el premio y cuántos sellos se necesitan, e imprimes el póster con tu QR para el mostrador.' }
];

const PLANS: { id: Plan; desc: string; best?: boolean; items: string[] }[] = [
  { id: 'basico', desc: 'Para tu primer local.', items: ['1 sucursal', 'Hasta 3 personas en tu equipo', 'Tarjeta en Apple y Google Wallet', 'Premio intermedio y regalo de cumpleaños', 'Estadísticas de 30 días', 'IA: 10 textos y 5 fotos al mes'] },
  { id: 'standard', best: true, desc: 'Para el negocio que ya tiene clientes que vuelven.', items: ['Hasta 3 sucursales', 'Hasta 10 personas en tu equipo', 'Notificaciones por cercanía', 'Alertas antifraude y exportar a Excel', 'Ideas de posts con tus datos', 'IA: 40 textos y 20 fotos al mes', 'Todo lo de Básico'] },
  { id: 'pro', desc: 'Para cadenas y franquicias.', items: ['Hasta 10 sucursales', 'Equipo sin límite', 'Reporte por persona del equipo', 'Calendario semanal y respuestas a reseñas', 'IA: 120 textos y 60 fotos al mes', 'Todo lo de Standard'] }
];

const I = {
  arrow: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>,
  check: <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" /></svg>,
  wa: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.8-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-2 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>,
  team: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>,
  gift: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4.5 9.5 8 12 8Zm0 0s1.5-5 4-3.5S14.5 8 12 8Z" /></svg>,
  qr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-4M14 18v3" /></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
};

function Iso({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path className="iso-card" d="M56.10 19.98A38 38 0 1 0 80.02 43.90A22 22 0 0 1 56.10 19.98Z" />
      <circle cx="78" cy="22" r="11" fill="#FFC301" />
    </svg>
  );
}

function price(plan: Plan) {
  const cents = PLAN_FEATURES[plan].priceCents;
  return { whole: Math.floor(cents / 100), dec: String(cents % 100).padStart(2, '0'), value: (cents / 100).toFixed(2) };
}

function jsonLd() {
  const url = appUrl();
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Stampa', url, logo: `${url}/icon.svg`, contactPoint: { '@type': 'ContactPoint', telephone: '+593990916553', contactType: 'sales', areaServed: 'EC', availableLanguage: 'es' } },
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Stampa', applicationCategory: 'BusinessApplication', operatingSystem: 'Web, iOS, Android', url, description: DESC,
      offers: PLANS.map((p) => ({ '@type': 'Offer', name: `Plan ${PLAN_LABEL[p.id]}`, price: price(p.id).value, priceCurrency: 'USD', description: p.desc }))
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
  ];
}

export default function Landing() {
  const STAMPS = 10;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\\u003c') }} />
      <div className="lp">
        <LandingFx />
        <header className="hdr">
          <div className="wrap hdr-in">
            <a href="#inicio" className="brand" aria-label="Stampa, inicio"><Iso />stampa</a>
            <nav className="nav" aria-label="Secciones">
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#funciones">Funciones</a>
              <a href="#precios">Precios</a>
              <a href="#preguntas">Preguntas</a>
            </nav>
            <div className="hdr-right">
              <ThemeToggle />
              <a href="/ingresar" className="btn btn-ghost btn-sm hide-sm">Ingresar</a>
              <a href={WA('Hola, quiero Stampa para mi negocio.')} target="_blank" rel="noopener" className="btn btn-sun btn-sm">Empezar</a>
              <details className="menu">
                <summary className="icon-btn" aria-label="Abrir menú"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></summary>
                <nav className="menu-panel" aria-label="Menú">
                  <a href="#como-funciona">Cómo funciona</a>
                  <a href="#funciones">Funciones</a>
                  <a href="#precios">Precios</a>
                  <a href="#preguntas">Preguntas</a>
                  <a href="/ingresar">Ingresar a mi panel</a>
                </nav>
              </details>
            </div>
          </div>
        </header>

        <main id="inicio">
          {/* Hero */}
          <section className="hero">
            <div className="wrap hero-grid">
              <div>
                <span className="badge" data-reveal><b>Nuevo</b>Avisos por cercanía en Wallet</span>
                <h1 className="h1" data-reveal style={{ ['--d' as string]: '.08s' }}>Que cada visita <span className="hl"><span>cuente.</span></span></h1>
                <p className="lead" data-reveal style={{ ['--d' as string]: '.16s' }}>
                  La tarjeta de sellos de tu negocio, en el teléfono de tus clientes. Escanean un QR, la guardan en su Wallet y vuelven más seguido. Sin apps, sin cartón.
                </p>
                <div className="hero-ctas" data-reveal style={{ ['--d' as string]: '.24s' }}>
                  <a href={WA('Hola, quiero Stampa para mi negocio.')} target="_blank" rel="noopener" className="btn btn-sun">Quiero Stampa{I.arrow}</a>
                  <a href="#como-funciona" className="btn btn-ghost">Ver cómo funciona</a>
                </div>
                <ul className="checks" data-reveal style={{ ['--d' as string]: '.32s' }}>
                  <li>{I.check}Lista en minutos</li>
                  <li>{I.check}Sin contratos</li>
                  <li>{I.check}Hecha en Ecuador</li>
                </ul>
              </div>

              <div className="stage" aria-hidden="true">
                <div className="notif">
                  <span className="ico"><Iso size={22} /></span>
                  <div><b>Pizzería Napoli</b><p>Estás a 50 m. Te falta 1 sello para tu pizza gratis 🍕</p></div>
                  <small>ahora</small>
                </div>
                <div className="phone">
                  <div className="screen">
                    <span className="notch" />
                    <div className="pcard">
                      <div className="pcard-top"><span className="plogo">PN</span><div><b>Pizzería Napoli</b><small>Tarjeta de pizzas</small></div></div>
                      <div className="pcard-body">
                        <div className="prow"><span>SELLOS</span><strong>9 / {STAMPS}</strong></div>
                        <div className="pbar"><i /></div>
                        <div className="stamps">
                          {Array.from({ length: STAMPS }, (_, i) => (
                            i < 9
                              ? <span key={i} className="on" style={{ animationDelay: `${0.6 + i * 0.12}s` }}>★</span>
                              : <span key={i} className="gift">🎁</span>
                          ))}
                        </div>
                        <div className="pcta">Escribir código</div>
                        <div className="wallet"> Agregar a Apple Wallet</div>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="chip c1"><i />+1 sello · Caja 2</span>
                <span className="chip c2">🎉 Premio listo</span>
              </div>
            </div>
          </section>

          <div className="strip">
            <div className="wrap strip-in">
              <span>{I.wallet}Apple y Google Wallet</span>
              <span>{I.pin}Avisos por cercanía</span>
              <span>{I.shield}Antifraude en caja</span>
              <span>{I.spark}Marketing con IA</span>
            </div>
          </div>

          {/* Cómo funciona */}
          <section id="como-funciona">
            <div className="wrap center">
              <span className="eyebrow" data-reveal>Cómo funciona</span>
              <h2 className="h2" data-reveal>Tres pasos. Cero fricción.</h2>
              <p className="lead" data-reveal>Tu cliente no descarga nada y tu cajero no aprende nada nuevo.</p>
              <div className="steps" style={{ textAlign: 'left' }}>
                {[
                  ['Escanea el QR', 'Tu cliente apunta la cámara al póster del mostrador, se registra en segundos y guarda la tarjeta en su Wallet.'],
                  ['Suma sellos en caja', 'Con cada compra, la caja genera un código de un solo uso. El cliente lo escanea y el sello aparece al instante.'],
                  ['Gana y vuelve', 'Al completar la tarjeta recibe su premio. Los avisos por cercanía y de cumpleaños lo traen de vuelta.']
                ].map(([t, d], i) => (
                  <div className="step" key={t} data-reveal style={{ ['--d' as string]: `${i * 0.1}s` }}>
                    <span className="n">{i + 1}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Funciones */}
          <section id="funciones" className="alt">
            <div className="wrap">
              <div className="center">
                <span className="eyebrow" data-reveal>Funciones</span>
                <h2 className="h2" data-reveal>Todo para que vuelvan.<br />Nada que te complique.</h2>
              </div>
              <div className="bento">
                <article className="feat hl-feat b-wide" data-reveal>
                  <span className="tag">STANDARD Y PRO</span>
                  <span className="fi">{I.pin}</span>
                  <h3>Notificaciones push por cercanía</h3>
                  <p>Cuando tu cliente pasa cerca de una sucursal, su teléfono le recuerda cuántos sellos le faltan. Sin apps, directo en la pantalla de bloqueo.</p>
                  <div className="ripple"><span /><span /><span /></div>
                </article>
                <article className="feat b-wide" data-reveal style={{ ['--d' as string]: '.08s' }}>
                  <span className="fi">{I.wallet}</span>
                  <h3>Apple Wallet y Google Wallet</h3>
                  <p>La tarjeta vive junto a sus tarjetas bancarias y se actualiza sola con cada sello. Nadie la pierde ni la olvida en casa.</p>
                </article>
                <article className="feat b-third" data-reveal>
                  <span className="fi">{I.shield}</span>
                  <h3>Antifraude en caja</h3>
                  <p>Códigos de un solo uso, monto mínimo, PIN del gerente y alertas si algo no cuadra.</p>
                </article>
                <article className="feat b-third" data-reveal style={{ ['--d' as string]: '.08s' }}>
                  <span className="fi">{I.chart}</span>
                  <h3>Panel con tus números</h3>
                  <p>Clientes activos, tasa de regreso, tu hora pico y tus mejores clientes, por sucursal.</p>
                </article>
                <article className="feat b-third" data-reveal style={{ ['--d' as string]: '.16s' }}>
                  <span className="fi">{I.spark}</span>
                  <h3>Marketing con IA</h3>
                  <p>Ideas de posts con tus datos, textos listos para redes y fotos de tus productos mejoradas.</p>
                </article>
                <article className="feat b-third" data-reveal>
                  <span className="fi">{I.team}</span>
                  <h3>Equipo y sucursales</h3>
                  <p>Usuarios para dueños, gerentes y cajeros, cada uno con lo que necesita ver.</p>
                </article>
                <article className="feat b-third" data-reveal style={{ ['--d' as string]: '.08s' }}>
                  <span className="fi">{I.gift}</span>
                  <h3>Premios y cumpleaños</h3>
                  <p>Premios intermedios para que no se rindan y un regalo automático en su cumpleaños.</p>
                </article>
                <article className="feat b-third" data-reveal style={{ ['--d' as string]: '.16s' }}>
                  <span className="fi">{I.qr}</span>
                  <h3>Póster con tu QR</h3>
                  <p>Con tu logo y tus colores, listo para imprimir y poner en el mostrador.</p>
                </article>
              </div>
            </div>
          </section>

          {/* Panel */}
          <section>
            <div className="wrap">
              <div className="center">
                <span className="eyebrow" data-reveal>Tu panel</span>
                <h2 className="h2" data-reveal>Sabe quién vuelve, cuándo y por qué.</h2>
                <p className="lead" data-reveal>Desde el celular o la computadora, en tiempo real.</p>
              </div>
              <div className="dash" data-reveal>
                <div className="kpis">
                  {[['Sellos entregados', '1.284', '+37 %'], ['Clientes activos', '312', '+18 %'], ['Tasa de regreso', '74 %', '+6 pts'], ['Premios canjeados', '96', '+22 %']].map(([l, v, d]) => (
                    <div className="kpi" key={l}><small>{l}</small><b>{v}</b><em>{d} vs. mes anterior</em></div>
                  ))}
                </div>
                <div className="bars">
                  {[28, 40, 34, 52, 46, 61, 58, 72, 66, 90, 80, 70, 84, 64].map((h, i) => (
                    <i key={i} className={h === 90 ? 'top' : undefined} style={{ height: `${h}%`, animationDelay: `${i * 0.04}s` }} />
                  ))}
                </div>
              </div>
              <div className="who" data-reveal>
                {['🍕 Pizzerías', '🍔 Restaurantes', '☕ Cafeterías', '💈 Barberías', '🏋️ Gimnasios', '🥐 Panaderías', '🍦 Heladerías'].map((w) => <span key={w}>{w}</span>)}
              </div>
            </div>
          </section>

          {/* Precios */}
          <section id="precios" className="alt">
            <div className="wrap">
              <div className="center">
                <span className="eyebrow" data-reveal>Precios</span>
                <h2 className="h2" data-reveal>Un plan para cada etapa.</h2>
                <p className="lead" data-reveal>Sin contratos. Cambias o cancelas cuando quieras.</p>
              </div>
              <div className="plans">
                {PLANS.map((p, i) => {
                  const pr = price(p.id);
                  const name = PLAN_LABEL[p.id];
                  return (
                    <article key={p.id} className={'plan' + (p.best ? ' best' : '')} data-reveal style={{ ['--d' as string]: `${i * 0.1}s` }}>
                      {p.best && <span className="pill">RECOMENDADO</span>}
                      <h3>{name}</h3>
                      <p className="pdesc">{p.desc}</p>
                      <div className="price" aria-label={`${pr.whole},${pr.dec} dólares al mes`}>
                        <span className="cur">$</span><span className="big">{pr.whole}</span><span className="cents">,{pr.dec}</span><span className="per">/mes</span>
                      </div>
                      <p className="iva">IVA incluido</p>
                      <ul>{p.items.map((it) => <li key={it}>{I.check}<span>{it}</span></li>)}</ul>
                      <a href={WA(`Hola, quiero el plan ${name} de Stampa.`)} target="_blank" rel="noopener" className={'btn ' + (p.best ? 'btn-sun' : 'btn-ghost')}>Quiero {name}</a>
                    </article>
                  );
                })}
              </div>
              <p className="plans-note">Precios en dólares (USD). El pago se coordina por WhatsApp.</p>
            </div>
          </section>

          {/* Preguntas */}
          <section id="preguntas">
            <div className="wrap">
              <div className="center">
                <span className="eyebrow" data-reveal>Preguntas frecuentes</span>
                <h2 className="h2" data-reveal>Lo que suelen preguntarnos.</h2>
              </div>
              <div className="faq">
                {FAQ.map((f, i) => (
                  <details key={f.q} data-reveal open={i === 0}>
                    <summary>{f.q}<span className="pm" aria-hidden="true">+</span></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* CTA final */}
          <section style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div className="final" data-reveal>
                <div className="dots" />
                <h2 className="h2" style={{ marginTop: 0, position: 'relative' }}>Te falta un sello.</h2>
                <p className="lead" style={{ position: 'relative' }}>Escríbenos y dejamos tu tarjeta lista hoy mismo.</p>
                <div className="hero-ctas" style={{ justifyContent: 'center', position: 'relative' }}>
                  <a href={WA('Hola, quiero Stampa para mi negocio.')} target="_blank" rel="noopener" className="btn btn-sun">{I.wa}Escribir por WhatsApp</a>
                  <a href="/ingresar" className="btn btn-ghost">Ingresar a mi panel</a>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer>
          <div className="wrap">
            <div className="foot">
              <div>
                <a href="#inicio" className="brand"><Iso />stampa</a>
                <p style={{ color: 'var(--muted)', marginTop: 12, maxWidth: 320, lineHeight: 1.6 }}>Tarjetas de sellos digitales para negocios que quieren que sus clientes vuelvan.</p>
              </div>
              <div>
                <h4>Producto</h4>
                <ul><li><a href="#funciones">Funciones</a></li><li><a href="#precios">Precios</a></li><li><a href="#preguntas">Preguntas</a></li><li><a href="/ingresar">Ingresar</a></li></ul>
              </div>
              <div>
                <h4>Contacto</h4>
                <ul><li><a href={WA('Hola, tengo una pregunta sobre Stampa.')} target="_blank" rel="noopener">WhatsApp {STAMPA_WHATSAPP_DISPLAY}</a></li><li><a href="/privacidad">Privacidad</a></li><li><a href="/terminos">Términos</a></li></ul>
              </div>
            </div>
            <div className="legal"><span>© {new Date().getFullYear()} Stampa · Ecuador</span><span>Los negocios de ejemplo son ficticios.</span></div>
          </div>
        </footer>
      </div>
    </>
  );
}
