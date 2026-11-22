import type { Metadata } from 'next';
import '@/components/landing/landing.css';
import { LandingFx, THEME_SCRIPT, ThemeToggle } from '@/components/landing/LandingFx';
import { StampCard } from '@/components/landing/StampCard';
import type { Plan } from '@/lib/contracts';
import { PLAN_FEATURES, PLAN_LABEL } from '@/lib/plans';
import { appUrl, stampaWhatsappUrl, STAMPA_WHATSAPP_DISPLAY } from '@/lib/urls';

/**
 * Landing de ventas (stampaecu.app). Dirección visual "la tarjeta en tus manos": la tarjeta interactiva es el único
 * elemento llamativo; el resto es tipográfico y sobrio, según el manual de marca (docs en src/components/landing/landing.css).
 * Los precios salen de PLAN_FEATURES. SEO/AEO: metadatos, Open Graph y JSON-LD (Organization, SoftwareApplication, FAQPage).
 */

const TITLE = 'Stampa · Tarjeta de sellos digital para tu negocio';
const DESC = 'Tarjeta de cliente frecuente en el teléfono de tus clientes, para restaurantes, cafeterías, barberías y gimnasios de Ecuador. Escanean un QR, la guardan en Apple o Google Wallet y reciben un aviso cuando pasan cerca. Sin apps.';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: TITLE,
  description: DESC,
  keywords: ['tarjeta de sellos digital', 'tarjeta de cliente frecuente', 'programa de fidelización', 'tarjeta de lealtad', 'Apple Wallet', 'Google Wallet', 'fidelizar clientes Ecuador', 'restaurantes', 'cafeterías', 'barberías'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'es_EC', url: '/', siteName: 'Stampa', title: TITLE, description: DESC, images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Stampa, tarjeta de sellos digital' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/og.png'] },
  robots: { index: true, follow: true }
};

const WA = (t: string) => stampaWhatsappUrl(t);
const HELLO = 'Hola, quiero Stampa para mi negocio.';

const FAQ: { q: string; a: string }[] = [
  { q: '¿Mis clientes tienen que descargar una app?', a: 'No. Escanean el QR de tu mostrador con la cámara, escriben su nombre y su correo, y guardan la tarjeta en Apple Wallet o Google Wallet. También la pueden abrir desde el navegador.' },
  { q: '¿Cómo funcionan los avisos por cercanía?', a: 'Cuando la tarjeta está en el Wallet, el teléfono de tu cliente le muestra un aviso al pasar cerca de una de tus sucursales: cuántos sellos le faltan y para qué. Viene en los planes Standard y Pro.' },
  { q: '¿Cómo evito que se regalen sellos?', a: 'Cada sello sale de un código de un solo uso que la caja genera para una compra real. Puedes pedir un monto mínimo, el código vence en minutos y hay tiempo de espera entre sellos. Si alguien repite un ticket o usa un código vencido, te avisamos.' },
  { q: '¿Sirve si tengo varias sucursales?', a: 'Sí. Standard incluye hasta 3 sucursales y Pro hasta 10. Ves todo en un solo panel, y cada persona de tu equipo entra con su usuario: dueño, gerente o caja.' },
  { q: '¿Qué hace la IA de marketing?', a: 'Te propone ideas de publicaciones con los datos de tu negocio, como tu día más flojo o tu hora pico; escribe los textos para Instagram, Facebook o WhatsApp, y mejora las fotos de tus productos sin inventarlos.' },
  { q: '¿Cuánto cuesta y cómo pago?', a: 'Desde $29,99 al mes con IVA incluido. No hay contratos: cambias o cancelas cuando quieras. Nos escribes por WhatsApp, eliges tu plan y te llega el acceso a tu correo.' },
  { q: '¿En cuánto tiempo la tengo lista?', a: 'En unos minutos. Subes tu logo, eliges el premio y cuántos sellos pide, e imprimes el póster con tu QR para el mostrador.' }
];

const PLANS: { id: Plan; for: string; best?: boolean; items: string[]; inherit?: string }[] = [
  { id: 'basico', for: 'Para tu primer local.', items: ['1 sucursal y hasta 3 personas', 'Tarjeta en Apple y Google Wallet', 'Premio intermedio y regalo de cumpleaños', 'Estadísticas de 30 días', '10 textos y 5 fotos con IA al mes'] },
  { id: 'standard', best: true, for: 'Para cuando ya tienes clientes que vuelven.', items: ['Hasta 3 sucursales y 10 personas', 'Avisos por cercanía', 'Alertas antifraude y exportar a Excel', 'Ideas de publicaciones con tus datos', '40 textos y 20 fotos con IA al mes'], inherit: 'Todo lo de Básico' },
  { id: 'pro', for: 'Para cadenas y franquicias.', items: ['Hasta 10 sucursales, equipo sin límite', 'Reporte por persona del equipo', 'Calendario semanal y respuestas a reseñas', '120 textos y 60 fotos con IA al mes'], inherit: 'Todo lo de Standard' }
];

const FEATURES: [string, string][] = [
  ['Antifraude en caja', 'Códigos de un solo uso, monto mínimo, PIN del gerente para casos especiales y alertas cuando algo no cuadra.'],
  ['Equipo y sucursales', 'Cada persona entra con su usuario y ve solo lo que le toca. El dueño ve todas las sucursales juntas.'],
  ['Marketing con IA', 'Ideas de publicaciones con tus números, textos listos para tus redes y fotos de tus productos mejoradas.'],
  ['Premios y cumpleaños', 'Premios intermedios para que nadie se rinda a mitad de tarjeta y un regalo el día de su cumpleaños.'],
  ['Tus mejores clientes', 'Quién viene más, quién dejó de venir y a quién le falta poco para su premio.'],
  ['Póster para el mostrador', 'Con tu logo, tus colores y tu QR, listo para imprimir.']
];

const WEEK: [string, number][] = [['L', 38], ['M', 30], ['M', 24], ['J', 46], ['V', 64], ['S', 100], ['D', 72]];

function Iso({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path className="iso-card" d="M56.10 19.98A38 38 0 1 0 80.02 43.90A22 22 0 0 1 56.10 19.98Z" />
      <circle cx="78" cy="22" r="11" fill="#FFC301" />
    </svg>
  );
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.8-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-2 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z" /></svg>
);

function price(plan: Plan) {
  const cents = PLAN_FEATURES[plan].priceCents;
  return { whole: Math.floor(cents / 100), dec: String(cents % 100).padStart(2, '0'), value: (cents / 100).toFixed(2) };
}

function jsonLd() {
  const url = appUrl();
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Stampa', url, logo: `${url}/icon.svg`, slogan: 'Cada visita cuenta.', contactPoint: { '@type': 'ContactPoint', telephone: '+593990916553', contactType: 'sales', areaServed: 'EC', availableLanguage: 'es' } },
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Stampa', applicationCategory: 'BusinessApplication', operatingSystem: 'Web, iOS, Android', url, description: DESC,
      offers: PLANS.map((p) => ({ '@type': 'Offer', name: `Plan ${PLAN_LABEL[p.id]}`, price: price(p.id).value, priceCurrency: 'USD', description: p.for }))
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
  ];
}

export default function Landing() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()).replace(/</g, '\\u003c') }} />
      <div className="lp">
        <LandingFx />
        <header className="hdr">
          <div className="wrap hdr-in">
            <a href="#inicio" className="logo" aria-label="Stampa, inicio"><Iso />stampa</a>
            <nav className="nav" aria-label="Secciones">
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#precios">Precios</a>
              <a href="#preguntas">Preguntas</a>
            </nav>
            <div className="hdr-r">
              <ThemeToggle />
              <a href="/ingresar" className="btn btn-line btn-sm">Ingresar</a>
              <a href={WA(HELLO)} target="_blank" rel="noopener" className="btn btn-sun btn-sm only-wide">Escríbenos</a>
              <details className="menu">
                <summary className="icon-btn" aria-label="Menú"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg></summary>
                <nav className="menu-panel" aria-label="Menú">
                  <a href="#como-funciona">Cómo funciona</a>
                  <a href="#precios">Precios</a>
                  <a href="#preguntas">Preguntas</a>
                  <a href={WA(HELLO)} target="_blank" rel="noopener">Escríbenos por WhatsApp</a>
                </nav>
              </details>
            </div>
          </div>
        </header>

        <main id="inicio">
          <section className="hero">
            <div className="wrap hero-in">
              <div>
                <h1 className="display">Cada visita cuenta<span className="dot">.</span></h1>
                <p className="intro">La tarjeta de sellos de tu negocio, en el teléfono de tus clientes. Sin cartón que se pierde y sin apps que descargar.</p>
                <div className="hero-cta">
                  <a href={WA(HELLO)} target="_blank" rel="noopener" className="btn btn-sun"><WaIcon />Escríbenos por WhatsApp</a>
                  <a href="#precios" className="quiet">Ver precios</a>
                </div>
                <ul className="facts">
                  <li><b>Lista en minutos</b></li>
                  <li>Desde <b>$29,99 al mes</b></li>
                  <li>Sin contratos</li>
                </ul>
              </div>
              <StampCard />
            </div>
          </section>

          <section id="como-funciona" className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <h2 className="title">Un sello, una visita, un premio<span className="dot">.</span></h2>
              <ol className="how">
                <li><h3>Escanea el QR del mostrador</h3><p>Tu cliente apunta la cámara, escribe su nombre y su correo, y guarda la tarjeta en su Wallet.</p></li>
                <li><h3>Pide su código en caja</h3><p>Con cada compra, la caja genera un código de un solo uso. Lo escanea y el sello aparece al instante.</p></li>
                <li><h3>Canjea su premio</h3><p>Al completar la tarjeta, se lleva su premio. Y empieza otra.</p></li>
              </ol>
            </div>
          </section>

          <section className="band sec" aria-labelledby="cerca">
            <div className="wrap band-in">
              <div>
                <h2 id="cerca" className="title">Te recuerda cuando pasa cerca<span className="dot">.</span></h2>
                <p className="intro">Con la tarjeta en Apple o Google Wallet, el teléfono de tu cliente le avisa al pasar por tu local: cuántos sellos le faltan y para qué. Sin apps y sin que tengas que escribirle.</p>
                <p className="plan-note">Viene en los planes <b>Standard</b> y <b>Pro</b>.</p>
              </div>
              <div className="lock" aria-hidden="true">
                <p className="lock-time">12:47</p>
                <p className="lock-date">viernes, 4 de diciembre</p>
                <div className="note">
                  <span className="note-ico"><Iso size={24} /></span>
                  <div><b>Pizzería Napoli</b><p>Estás cerca. Te faltan 2 sellos para tu pizza gratis.</p></div>
                  <small>ahora</small>
                </div>
                <div className="note second">
                  <span className="note-ico"><Iso size={24} /></span>
                  <div><b>Pizzería Napoli</b><p>¡Sello 8 de 10!</p></div>
                  <small>ayer</small>
                </div>
              </div>
            </div>
          </section>

          <section className="sec" aria-labelledby="panel">
            <div className="wrap">
              <h2 id="panel" className="title">Sabes quién vuelve y cuándo<span className="dot">.</span></h2>
              <div className="week">
                <div>
                  <p className="week-num" aria-hidden="true">42</p>
                  <p className="week-cap">clientes volvieron esta semana. Tu mejor día fue el sábado.</p>
                </div>
                <div className="week-bars" role="img" aria-label="Visitas por día de la semana; el sábado es el día con más visitas">
                  {WEEK.map(([d, h], i) => (
                    <div key={i} className={h === 100 ? 'best' : undefined}><i style={{ height: `${h * 1.5}px` }} />{d}</div>
                  ))}
                </div>
              </div>
              <dl className="feats">
                {FEATURES.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
              </dl>
            </div>
          </section>

          <section id="precios" className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <h2 className="title">Un plan para cada etapa<span className="dot">.</span></h2>
              <p className="body" style={{ marginTop: 16 }}>Precios en dólares, con IVA incluido. Sin contratos: cambias o cancelas cuando quieras.</p>
              <div className="plans">
                {PLANS.map((p) => {
                  const pr = price(p.id);
                  const name = PLAN_LABEL[p.id];
                  return (
                    <article key={p.id} className={'plan' + (p.best ? ' best' : '')} aria-labelledby={`plan-${p.id}`}>
                      <h3 id={`plan-${p.id}`}>{name}{p.best && <small>El más elegido</small>}</h3>
                      <p className="for">{p.for}</p>
                      <p className="amount" aria-label={`${pr.whole},${pr.dec} dólares al mes`}><b>${pr.whole}</b><sup>,{pr.dec}</sup><span>al mes</span></p>
                      <ul>
                        {p.items.map((it) => <li key={it}>{it}</li>)}
                        {p.inherit && <li className="inherit">{p.inherit}</li>}
                      </ul>
                      <a href={WA(`Hola, quiero el plan ${name} de Stampa.`)} target="_blank" rel="noopener" className={'btn ' + (p.best ? 'btn-sun' : 'btn-line')}>Quiero {name}</a>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="preguntas" className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <h2 className="title">Preguntas frecuentes<span className="dot">.</span></h2>
              <div className="faq">
                {FAQ.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap closing">
              <h2 className="display" style={{ fontSize: 'clamp(40px, 6.5vw, 76px)' }}>Te falta un sello<span className="dot">.</span></h2>
              <div className="hero-cta">
                <a href={WA(HELLO)} target="_blank" rel="noopener" className="btn btn-sun"><WaIcon />Escríbenos por WhatsApp</a>
                <a href="/ingresar" className="quiet">Ya tengo cuenta</a>
              </div>
            </div>
          </section>
        </main>

        <footer>
          <div className="wrap">
            <div className="foot">
              <a href="#inicio" className="logo"><Iso />stampa</a>
              <nav aria-label="Pie de página">
                <a href={WA('Hola, tengo una pregunta sobre Stampa.')} target="_blank" rel="noopener">WhatsApp {STAMPA_WHATSAPP_DISPLAY}</a>
                <a href="/ingresar">Ingresar</a>
                <a href="/privacidad">Privacidad</a>
                <a href="/terminos">Términos</a>
              </nav>
            </div>
            <p style={{ marginTop: 24 }} className="fine">© {new Date().getFullYear()} Stampa, Ecuador. Los negocios y las cifras de esta página son ejemplos.</p>
            <p className="giant" aria-hidden="true">stampa</p>
          </div>
        </footer>
      </div>
    </>
  );
}
