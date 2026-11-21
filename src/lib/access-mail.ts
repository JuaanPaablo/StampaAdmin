import type { IssuedToken } from './contracts';
import { brandEmail, sendEmail, type EmailResult } from './email';
import { inviteUrl, resetUrl } from './urls';

/**
 * Correos de acceso (invitación y restablecer contraseña). Los usan el panel de administrador (invitación al dueño),
 * el panel del dueño (invitar a su equipo) y "¿Olvidaste tu contraseña?".
 * Devuelve el resultado del envío y el enlace, para que la pantalla pueda ofrecer "Copiar enlace" o "Enviar por WhatsApp".
 */
export async function sendAccessEmail(opts: {
  to: string;
  token: IssuedToken;
  businessName?: string;     // ausente o provisional en la invitación de un negocio nuevo
  inviterName?: string;      // quien invita (dueño) cuando es alguien del equipo
}): Promise<{ result: EmailResult; url: string }> {
  const isInvite = opts.token.kind === 'invite';
  const url = isInvite ? inviteUrl(opts.token.token) : resetUrl(opts.token.token);
  const content = isInvite
    ? brandEmail({
        title: opts.businessName ? `Te invitaron a ${opts.businessName}` : 'Tu cuenta de Stampa está lista',
        lines: opts.businessName
          ? [`${opts.inviterName ?? 'Tu equipo'} te dio acceso al panel de ${opts.businessName} en Stampa.`, 'Crea tu contraseña para entrar. El enlace vence en 72 horas.']
          : ['Ya tienes acceso al panel de Stampa.', 'Crea tu contraseña y configura tu negocio en pocos minutos: nombre, logo, sucursales y tu tarjeta de sellos.', 'El enlace vence en 72 horas.'],
        cta: { label: 'Crear mi contraseña', url }
      })
    : brandEmail({
        title: 'Cambia tu contraseña',
        lines: ['Pediste cambiar tu contraseña de Stampa.', 'El enlace vence en 60 minutos. Si no fuiste tú, ignora este correo.'],
        cta: { label: 'Cambiar mi contraseña', url }
      });
  const subject = isInvite
    ? (opts.businessName ? `Te invitaron a ${opts.businessName} en Stampa` : 'Tu acceso a Stampa')
    : 'Cambia tu contraseña de Stampa';
  const result = await sendEmail({ to: opts.to, subject, ...content });
  return { result, url };
}

/** Código de 6 dígitos para que el cliente confirme su correo. */
export async function sendOtpEmail(opts: { to: string; code: string; businessName?: string }): Promise<EmailResult> {
  const content = brandEmail({
    title: 'Tu código de Stampa',
    lines: [
      opts.businessName ? `Úsalo para abrir tu tarjeta de ${opts.businessName}.` : 'Úsalo para abrir tus tarjetas.',
      'Vence en 10 minutos. Si no lo pediste, ignora este correo.'
    ],
    code: opts.code
  });
  return sendEmail({ to: opts.to, subject: `${opts.code} es tu código de Stampa`, ...content });
}
