# Stampa MVP: especificación de trabajo

Decidido con el cliente el 21/11/2026. Todo agente que trabaje en el MVP sigue este documento. Si algo no está aquí,
elige la opción más simple y coherente con lo existente, y déjalo anotado en tu informe final.

## Producto

Tres superficies en la misma app Next.js (este repo), servida en `https://stampaecu.app` (`NEXT_PUBLIC_APP_URL`):

| Superficie | Ruta | Quién entra |
|---|---|---|
| Panel de administrador de Stampa | `/admin/**` | Solo la cuenta `administrador@stampa.com` (tabla aparte, cookie `stampa_admin`) |
| Panel del dueño y su equipo | `/panel/**`, `/bienvenida`, `/ingresar` | Dueños, gerentes y cajeros (cookie `stampa_session`, ya existe) |
| Tarjeta del cliente | `/u/<slug>/**`, `/mis-tarjetas` | Público. El cliente se identifica con su correo verificado (cookie `stampa_cliente`) |

### Flujo completo

1. **Admin** (`/admin/negocios/nuevo`): escribe el correo del dueño, el plan (`gratis | negocio | pro`), la fecha de
   vencimiento (opcional) y una nota interna (opcional). `repo.createBusinessAccess()` crea el negocio en estado `setup`
   y la invitación. Se envía el correo con `sendAccessEmail()` y la pantalla SIEMPRE muestra el enlace con botones
   "Copiar enlace" y "Enviar por WhatsApp" (`shareWhatsappUrl`). El admin no crea nombre, logo ni tarjeta.
2. **Dueño** abre `/invitacion/<token>`: ve "Crea tu contraseña", escribe su nombre y contraseña (mínimo 10
   caracteres, dos veces). `repo.consumeAccessToken()` → crea la sesión → `/bienvenida`.
3. **Asistente `/bienvenida`** (mientras `business.status === 'setup'` todo `/panel` redirige aquí):
   1. Tu negocio: nombre, tipo (de `TEMPLATES`), ciudad → `saveBusinessSetup()`.
   2. Tu imagen: logo y foto de portada (opcionales, se pueden saltar) → `uploadBusinessImage()`; colores de la tarjeta.
   3. Tus sucursales: al menos una (nombre y dirección) → `upsertLocation()`.
   4. Tu tarjeta: sellos necesarios, premio, monto mínimo, regalo de cumpleaños, con vista previa → `updateProgram()`.
   5. Listo → `completeBusinessSetup()` → `/panel` con "Descarga tu póster QR".
4. **Cliente** escanea el póster (`customerUrl(slug)` = `/u/<slug>`):
   - Sin sesión: formulario nombre, fecha de nacimiento (día, mes, año) y correo, y casilla de consentimiento con enlace a
     `/privacidad`. → `requestEmailOtp()` → correo con `sendOtpEmail()` → pantalla de 6 dígitos → `verifyEmailOtp()` →
     `registerVerifiedCustomer()` → cookie `stampa_cliente` (365 días) → su tarjeta.
   - "Ya tengo tarjeta": solo correo → código → cookie → su tarjeta (si no existe en ese negocio, completa nombre y fecha).
   - Con sesión: ve su tarjeta directamente (diseño del manual, sección 6.1).
5. **Sello**: el cajero crea el código en `/panel/caja` (ya existe). El QR de la pantalla codifica
   `stampUrl(slug, code)` = `/u/<slug>/sello?c=123456`. El cliente lo escanea con la cámara → si tiene sesión, se reclama
   con `claimStampCode()` y ve "¡Sello 7 de 10!"; si no, se registra primero y luego se reclama. En la tarjeta también hay
   "Escribir código" para los 6 dígitos a mano.
6. **Canje**: el cliente con la tarjeta completa muestra su pantalla; el cajero canjea desde el panel (ya existe).

### Estados del negocio

- `setup`: invitado, asistente sin terminar. `/u/<slug>` muestra "Muy pronto". No acepta clientes ni sellos.
- `active`: normal.
- `suspended`: el dueño y su equipo ven `/suspendido` ("Tu cuenta está pausada. Escríbenos por WhatsApp" con
  `stampaWhatsappUrl`). Los clientes ven su tarjeta congelada (solo lectura) y no pueden sumar sellos ni registrarse.
- `planExpiresAt`: solo informativo. El admin ve avisos (vence en 7 días o menos / vencido); el dueño ve un aviso en
  Ajustes → Plan. Vencer NO suspende automáticamente: suspender es una acción manual del admin.

### Cobro

Fuera de la app. Ajustes → Plan muestra el plan, el vencimiento y el botón "Escríbenos por WhatsApp"
(`stampaWhatsappUrl('Hola, quiero ... mi plan de Stampa para <negocio>')`), número +593 99 091 6553.

## Piezas compartidas (ya existen, no las dupliques)

- `src/lib/contracts.ts`: tipos. Solo se AGREGA.
- `src/lib/repo/index.ts`: interfaz `Repo` con todos los métodos del MVP documentados. El repo en memoria ya los implementa.
- `src/lib/mvp-rules.ts`: constantes y validaciones (planes, OTP, imágenes, slug provisional, `businessStatus`, `daysToExpiry`).
- `src/lib/tokens.ts`: tokens y códigos (hash SHA-256; nunca guardar el valor en claro).
- `src/lib/signed.ts`: `signData` / `verifyData` con `aud` (`'admin'` para `stampa_admin`, `'cliente'` para `stampa_cliente`).
- `src/lib/urls.ts`: TODAS las URLs públicas y de WhatsApp. Nada de `stampa.example`.
- `src/lib/email.ts` + `src/lib/access-mail.ts`: envío con Resend y plantillas. Sin `RESEND_API_KEY`, `sendEmail` devuelve
  `{ sent: false, preview: true }` cuando `emailPreviewEnabled()`: la pantalla muestra el código/enlace con el aviso
  "Modo de prueba: el correo no se envió". En producción con `STAMPA_EMAIL_PREVIEW` apagado se muestra un error genérico.

## Reglas de implementación

- Español de Ecuador, tuteo, frases cortas, sin anglicismos (manual de marca, sección 5). "Sello 7 de 10", "Te faltan 3".
- Marca: Azul Noche `#001D3D` (fondos), Azul Stampa `#013565` (superficies), Amarillo Sello `#FFC301` (sellos, botones,
  llamados a la acción), Amarillo Luz `#FFD60C` (hover), Negro Tinta `#010713`. Proporción 75/20/5. Sora para títulos y
  cifras, Inter para texto. Ya están en `tailwind.config.ts` (`navy`, `sun`, `ink`, `font-display`). Logo: `Isotipo` y
  `Wordmark` en `src/components/shell/logo.tsx`. La página del cliente sigue el mock 6.1 del manual
  (`stampa-manual-de-marca.pdf`): tarjeta del negocio arriba (la marca del negocio va primero), sellos con el isotipo,
  barra amarilla de progreso, "Te faltan N sellos para tu <premio>", últimas visitas, pie "con Stampa".
- Móvil primero para todo lo del cliente (360 px). Botones de 48 px de alto. Contraste AA.
- Server actions con validación en servidor; nunca confíes en el cliente. Comprueba la sesión y el rol en cada acción.
- Sin dependencias nuevas salvo que sea imprescindible (ya hay `qrcode` y `zod`).
- Sin `localStorage` para nada importante.
- Cada mensaje de error se muestra en español y nunca revela si un correo existe (olvidé mi contraseña, códigos).
- Límites: OTP máx. 5 por correo por hora, 5 intentos por código, 10 min de vigencia. Login: los límites que ya existen.
- Pruebas: Vitest junto al código (`*.test.ts`). `npm run typecheck`, `npm test` y `npm run build` deben pasar antes de
  terminar. Para probar en el navegador: `npm run dev` (repo en memoria con datos de ejemplo; admin de ejemplo
  `administrador@stampa.com` / `Stampa-Demo-2026`).

## Dueños de archivos (para trabajar en paralelo sin choques)

| Agente | Es dueño de | No toca |
|---|---|---|
| Datos | `supabase/**`, `src/lib/repo/supabase.ts`, pruebas nuevas en `src/lib/repo/`, `scripts/**`, scripts de `package.json` | interfaz, `memory.ts` (solo corrige errores reales y lo informa) |
| Admin y acceso | `src/app/admin/**`, `src/components/admin/**`, `src/lib/admin-session.ts`, `src/app/invitacion/**`, `src/app/restablecer/**`, `src/app/ingresar/**` (incluye "¿Olvidaste tu contraseña?") | `/panel`, `/u` |
| Dueño | `src/app/panel/**`, `src/app/bienvenida/**`, `src/app/suspendido/**`, `src/lib/context.ts`, `src/components/{card,team,shell,dashboard,register,customers,control,ui}/**` | `/admin`, `/u` |
| Cliente | `src/app/u/**`, `src/app/mis-tarjetas/**`, `src/app/privacidad/**`, `src/app/terminos/**`, `src/components/customer/**`, `src/lib/customer-session.ts` | `/panel`, `/admin` |

Archivos compartidos (`contracts.ts`, `repo/index.ts`, `memory.ts`, `mvp-rules.ts`, `urls.ts`, `email.ts`, `access-mail.ts`,
`tailwind.config.ts`, `src/app/layout.tsx`, `globals.css`): NO los cambies. Si necesitas algo ahí, ponlo en un archivo
tuyo o descríbelo en tu informe final para que el integrador lo agregue.
