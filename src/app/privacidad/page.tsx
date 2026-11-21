import type { Metadata, Viewport } from 'next';
import { LEGAL, LegalPage, Placeholder } from '@/components/customer/legal';

export const metadata: Metadata = { title: 'Privacidad · Stampa', robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#001D3D' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      intro={<p>Así cuidamos tus datos cuando usas una tarjeta de sellos de Stampa. La escribimos corta y clara, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP).</p>}
    >
      <h2>Quién trata tus datos</h2>
      <p>
        <strong>El negocio</strong> donde creas tu tarjeta es el <strong>responsable</strong> del tratamiento: decide para qué usa tus datos dentro de su programa de sellos.
      </p>
      <p>
        <strong>Stampa</strong> (<Placeholder>{LEGAL.razonSocial}</Placeholder>, RUC <Placeholder>{LEGAL.ruc}</Placeholder>) es el <strong>encargado</strong> del tratamiento:
        guarda y procesa los datos por cuenta del negocio, solo para que la tarjeta funcione.
      </p>

      <h2>Qué datos pedimos</h2>
      <ul>
        <li>Tu nombre.</li>
        <li>Tu fecha de nacimiento (día, mes y año).</li>
        <li>Tu correo electrónico, que confirmas con un código.</li>
        <li>Tus sellos, premios canjeados y la fecha y hora de cada visita.</li>
      </ul>
      <p>No pedimos cédula, dirección ni datos de pago.</p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Llevar tu tarjeta de sellos en el negocio: sumar sellos, mostrarte cuánto te falta y entregarte tu premio.</li>
        <li>Identificarte con tu correo para que abras tu tarjeta en tu teléfono.</li>
        <li>Saludarte y, si el negocio lo ofrece, darte un regalo de cumpleaños.</li>
        <li>Evitar abusos, como sellos repetidos o códigos compartidos.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>

      <h2>Base legal</h2>
      <p>Tu consentimiento, que das al marcar la casilla &quot;Acepto el tratamiento de mis datos&quot;, y la ejecución del programa de sellos al que te unes. Puedes retirar tu consentimiento cuando quieras.</p>

      <h2>Quién más los ve</h2>
      <p>Solo el negocio de cada tarjeta y su equipo (por ejemplo, el cajero al sumar o canjear). Un negocio no ve tus tarjetas de otros negocios. Usamos proveedores de alojamiento y de envío de correos que tratan los datos solo por encargo nuestro y con medidas de seguridad.</p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>Mientras tu tarjeta esté activa. Si no la usas en 24 meses, o si pides eliminarla, borramos o anonimizamos tus datos, salvo lo que la ley nos obligue a conservar.</p>

      <h2>Tus derechos</h2>
      <p>Puedes pedir en cualquier momento:</p>
      <ul>
        <li><strong>Acceso:</strong> saber qué datos tuyos tenemos.</li>
        <li><strong>Rectificación:</strong> corregirlos si están mal.</li>
        <li><strong>Eliminación:</strong> borrarlos.</li>
        <li><strong>Oposición:</strong> que dejemos de usarlos para algún fin.</li>
        <li><strong>Portabilidad:</strong> recibirlos en un formato que puedas llevar a otro lado.</li>
      </ul>
      <p>
        Escríbenos a <Placeholder>{LEGAL.correo}</Placeholder> desde el correo de tu tarjeta, o pídeselo al negocio. Respondemos en un máximo de 15 días.
        Si no quedas conforme, puedes acudir a la Superintendencia de Protección de Datos Personales.
      </p>

      <h2>Seguridad</h2>
      <p>La conexión va cifrada (HTTPS). Los códigos de acceso vencen en 10 minutos y nunca se guardan en claro. Tu sesión en el teléfono está firmada y puedes cerrarla con &quot;No soy yo / salir&quot;. Solo el equipo autorizado del negocio accede a sus clientes.</p>

      <h2>Menores de edad</h2>
      <p>Si tienes menos de 15 años, pide a tu madre, padre o representante que cree la tarjeta contigo.</p>

      <h2>Cambios</h2>
      <p>Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos.</p>
    </LegalPage>
  );
}
