/**
 * Envío de correos con Resend (https://resend.com/docs/api-reference/emails/send-email), sin dependencias.
 *
 * Variables:
 *   RESEND_API_KEY        clave de Resend. Sin ella no se envía nada.
 *   EMAIL_FROM            remitente, p. ej. "Stampa <hola@stampaec.app>" (el dominio debe estar verificado en Resend).
 *   STAMPA_EMAIL_PREVIEW  "on" = sin clave, la app MUESTRA en pantalla el código o el enlace (solo para pruebas).
 *                         En desarrollo (NODE_ENV !== 'production') la vista previa está activa por defecto.
 *
 * Regla: quien llama decide qué mostrar. Si sendEmail devuelve { sent: false, preview: true } puede enseñar el código o
 * el enlace en pantalla con un aviso "Modo de prueba". Si devuelve { sent: false, preview: false } muestra un error genérico.
 */

export interface EmailMessage { to: string; subject: string; text: string; html: string }
export type EmailResult = { sent: true } | { sent: false; preview: boolean; error?: string };

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

/** true cuando no hay Resend y se permite mostrar códigos o enlaces en pantalla. */
export function emailPreviewEnabled(): boolean {
  if (emailConfigured()) return false;
  if (process.env.STAMPA_EMAIL_PREVIEW === 'on') return true;
  if (process.env.STAMPA_EMAIL_PREVIEW === 'off') return false;
  return process.env.NODE_ENV !== 'production';
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV !== 'production') console.info(`[correo de prueba] a ${msg.to}: ${msg.subject}`);
    return { sent: false, preview: emailPreviewEnabled() };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || 'Stampa <hola@stampaec.app>',
        to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('sendEmail: Resend respondió', res.status, body.slice(0, 300));
      return { sent: false, preview: false, error: `Resend ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('sendEmail:', e instanceof Error ? e.message : e);
    return { sent: false, preview: false, error: 'network' };
  }
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

const FONT_TEXT = 'Inter,Segoe UI,Arial,sans-serif';
const FONT_HEAD = 'Sora,Segoe UI,Arial,sans-serif';

/**
 * Plantilla HTML de marca (Azul Noche, Amarillo Sello, tuteo, frases cortas). `lines` son párrafos de texto plano;
 * `cta` agrega un botón amarillo; `code` muestra un código grande. Todo se escapa.
 */
export function brandEmail(opts: { title: string; lines: string[]; cta?: { label: string; url: string }; code?: string; footer?: string }): { html: string; text: string } {
  const footer = opts.footer ?? 'Stampa · Cada visita cuenta.';
  const paragraphs = opts.lines
    .map((l) => `<p style="margin:0 0 14px;font:16px/1.6 ${FONT_TEXT};color:#001D3D">${esc(l)}</p>`)
    .join('');
  const code = opts.code
    ? `<p style="margin:8px 0 22px;font:800 34px/1 ${FONT_HEAD};letter-spacing:8px;color:#001D3D">${esc(opts.code)}</p>`
    : '';
  const cta = opts.cta
    ? `<p style="margin:8px 0 22px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#FFC301;color:#001D3D;text-decoration:none;font:600 16px ${FONT_TEXT};padding:14px 22px;border-radius:12px">${esc(opts.cta.label)}</a></p>` +
      `<p style="margin:0 0 14px;font:13px/1.5 ${FONT_TEXT};color:#4A6380">Si el botón no funciona, copia este enlace:<br><span style="word-break:break-all">${esc(opts.cta.url)}</span></p>`
    : '';
  const html =
    `<!doctype html><html lang="es"><body style="margin:0;background:#F3F6FA;padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">` +
    `<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">` +
    `<tr><td style="background:#001D3D;padding:20px 28px"><span style="font:800 22px ${FONT_HEAD};color:#ffffff">stampa</span>` +
    `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#FFC301;margin-left:4px"></span></td></tr>` +
    `<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font:700 24px/1.2 ${FONT_HEAD};color:#001D3D">${esc(opts.title)}</h1>` +
    `${paragraphs}${code}${cta}<p style="margin:18px 0 0;font:13px/1.5 ${FONT_TEXT};color:#4A6380">${esc(footer)}</p></td></tr>` +
    `</table></td></tr></table></body></html>`;
  const text = [
    opts.title, '', ...opts.lines,
    ...(opts.code ? ['', opts.code] : []),
    ...(opts.cta ? ['', `${opts.cta.label}: ${opts.cta.url}`] : []),
    '', footer
  ].join('\n');
  return { html, text };
}
