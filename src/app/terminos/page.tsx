import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { LEGAL, LegalPage, Placeholder } from '@/components/customer/legal';

export const metadata: Metadata = { title: 'Términos · Stampa', robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#001D3D' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos de uso"
      intro={<p>Estas son las reglas de las tarjetas de sellos de Stampa para clientes. Al crear tu tarjeta las aceptas.</p>}
    >
      <h2>Qué es Stampa</h2>
      <p>
        Stampa (<Placeholder>{LEGAL.razonSocial}</Placeholder>, RUC <Placeholder>{LEGAL.ruc}</Placeholder>) ofrece a los negocios una tarjeta de sellos digital.
        Tú la usas gratis desde tu teléfono, sin descargar apps.
      </p>

      <h2>Tu tarjeta</h2>
      <ul>
        <li>Es personal: una por correo en cada negocio.</li>
        <li>Sumas un sello con el código que te dan en caja después de una compra o visita válida.</li>
        <li>Cada código sirve una sola vez por persona y vence en pocos minutos.</li>
        <li>No se pueden vender, transferir ni cambiar los sellos o premios por dinero.</li>
      </ul>

      <h2>Premios</h2>
      <p>
        Cada negocio decide su premio, cuántos sellos pide y sus condiciones (por ejemplo, la vigencia del premio). Las ves en tu tarjeta.
        El negocio es quien entrega el premio y responde por él.
      </p>

      <h2>Uso correcto</h2>
      <p>Si alguien intenta sumar sellos con códigos ajenos, repetidos o inventados, el negocio puede anular esos sellos o cerrar la tarjeta.</p>

      <h2>Cambios y pausas</h2>
      <p>
        El negocio puede cambiar o terminar su programa de sellos. Si un negocio pausa su tarjeta, tus sellos quedan guardados pero no se pueden sumar
        ni canjear mientras dure la pausa.
      </p>

      <h2>Tus datos</h2>
      <p>Los tratamos como explica nuestra <Link href="/privacidad" className="font-semibold underline underline-offset-2">política de privacidad</Link>.</p>

      <h2>Responsabilidad</h2>
      <p>Hacemos lo posible para que la tarjeta funcione siempre, pero puede haber interrupciones breves por mantenimiento o fallas ajenas a nosotros.</p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República del Ecuador.</p>
    </LegalPage>
  );
}
