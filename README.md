# Stampa Admin

Stampa: tarjetas de sellos digitales de fidelización para negocios (restaurantes, cafeterías, gimnasios, floristerías, barberías y más). Esta app tiene tres partes: el panel de administrador de Stampa (`/admin`), el panel del dueño y su equipo (`/panel`) y la tarjeta del cliente (`/u/<negocio>`). Producto, flujo y reglas del MVP: `docs/MVP.md`. Un solo panel multi-negocio; el tipo de negocio cambia el vocabulario ("Caja" / "Recepción", "cliente" / "socio" / "comensal", "ticket" / "ficha" / "factura") y los valores iniciales de la tarjeta.

Stack: Next.js 14 (App Router, server actions), TypeScript estricto, Tailwind, Supabase (producción), Vitest. Español de Ecuador, USD.

## Cómo ejecutarlo

```bash
npm install
npm run dev          # http://localhost:3000, datos de ejemplo en memoria, modo demo activo
npm test             # Vitest
npm run typecheck    # tsc --noEmit
npm run build && npm start
```

El repositorio en memoria vive en `globalThis`, así que sobrevive entre rutas y recargas, pero se reinicia al reiniciar el proceso.

Acceso: correo + contraseña (ver "Autenticación"). Con el repo en memoria usa las cuentas de la sección "Cuentas de demo". `STAMPA_DEMO` solo activa las herramientas "Probar en la demo" de cada código (simular escaneos); activo en `npm run dev`, apagado en `npm start`, `STAMPA_DEMO=on` para una demo desplegada. No afecta al inicio de sesión.

## Autenticación

- Sin registro público. Stampa da acceso desde `/admin/negocios/nuevo` (correo del dueño, plan, vencimiento, nota). El dueño recibe un enlace de invitación (72 h, un solo uso) en `/invitacion/<token>`, crea su contraseña y configura su negocio en `/bienvenida`. El dueño invita a su equipo desde `/panel/equipo`.
- Recuperar contraseña: `/ingresar/olvide` envía un enlace de 60 minutos a `/restablecer/<token>`. Los tokens se guardan solo como hash SHA-256.
- Administrador de Stampa: tabla `platform_admins`, cookie `stampa_admin` (12 h). Crear o cambiar su contraseña: `npm run admin:create -- --email administrador@stampa.com` o desde `/admin/cuenta`.
- Clientes: confirman su correo con un código de 6 dígitos (10 min, 5 intentos, 5 por hora). Cookie `stampa_cliente` (365 días). El mismo código sirve para recuperar la tarjeta en otro teléfono.
- Correos: Resend (`RESEND_API_KEY`, `EMAIL_FROM`). Sin clave y con `STAMPA_EMAIL_PREVIEW=on`, la pantalla muestra el enlace o código con el aviso "Modo de prueba".
- Sesión: cookie `stampa_session` (httpOnly, Secure en producción, SameSite=Lax) firmada con HMAC-SHA256 y `AUTH_SECRET`. Dura 12 h (30 días con "Recordarme"). En producción `AUTH_SECRET` es obligatorio (mínimo 32 caracteres; `openssl rand -base64 32`); sin él la app falla con un error claro. Sin sesión válida todo `/panel` redirige a `/ingresar`, también en `next dev`.
- Contraseñas: scrypt con sal aleatoria (`scrypt$N$r$p$salt$hash`), mínimo 10 caracteres. El hash nunca sale del repo.
- Anti fuerza bruta: 5 fallos seguidos bloquean la cuenta 15 minutos (en Supabase en las columnas de `staff`; los correos inexistentes se bloquean igual para no revelar cuáles existen) y un límite por IP en memoria del proceso (best effort).
- El PIN de 4 dígitos ya no sirve para entrar: solo aprueba acciones dentro del panel (más cupos de los permitidos).

### Cuentas de demo

Admin de ejemplo: `administrador@stampa.com` / `Stampa-Demo-2026`. Solo aplican con el repo en memoria (`STAMPA_REPO` sin definir o `memory`); no existen en Supabase. Contraseña común: `Stampa-Demo-2026`. Correo: `<nombre>@<negocio>.demo`. PIN de aprobaciones: dueño 1234, gerente 2345, cajeros 1111.

| Negocio | Dueño | Gerente | Cajeros |
|---|---|---|---|
| Café La Esquina (`biz_esquina`) | andrea@esquina.demo | ricardo@esquina.demo | pedro@esquina.demo, marco@esquina.demo, lucia@esquina.demo |
| Gimnasio Pulso (`biz_pulso`) | fernando@pulso.demo | gabriela@pulso.demo | kevin@pulso.demo, sofia@pulso.demo |
| Floristería Pétalo (`biz_petalo`) | marcela@petalo.demo | paola@petalo.demo | daniela@petalo.demo, joselyn@petalo.demo |
| La Mesa de Ana (`biz_mesa`) | ana@mesa.demo | luis@mesa.demo | carla@mesa.demo, jorge@mesa.demo |
| Barbería Don Lucho (`biz_donlucho`) | luis@donlucho.demo | byron@donlucho.demo | wilson@donlucho.demo, cristian@donlucho.demo |

### Crear cuentas

Requiere `STAMPA_REPO=supabase`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (en el entorno o en `.env.local`):

```bash
npm run account:create -- --business biz_esquina --name "Andrea Zambrano" --role owner --email andrea@cafe.com
# --business: id o slug · --role: owner | manager | cashier
# --password "..." (opcional, mínimo 10): si falta, genera una aleatoria y la imprime UNA sola vez
# --staff emp_xxx : en lugar de --name/--role, pone credenciales a una persona que ya existe (también para restablecer la contraseña)
```

Comparte la contraseña por un canal seguro. La migración `0003_auth.sql` debe estar aplicada antes.

## Mapa de rutas

| Ruta | Qué hace | Roles |
|---|---|---|
| `/admin/**` | Panel de Stampa: resumen, negocios, dar acceso, suspender/reactivar, plan y vencimiento, reenviar acceso, mi cuenta | administrador |
| `/ingresar`, `/ingresar/olvide` | Inicio de sesión y recuperar contraseña (`/registro` redirige aquí) | público |
| `/invitacion/[token]`, `/restablecer/[token]` | Crear o cambiar la contraseña con el enlace | público con enlace |
| `/bienvenida` | Asistente de 5 pasos mientras el negocio está en configuración | dueño |
| `/suspendido` | Cuenta pausada, con botón de WhatsApp | equipo |
| `/u/[slug]` | Tarjeta del cliente: alta, ingreso con código, su tarjeta | público |
| `/u/[slug]/sello?c=` | Destino del QR de caja: reclama el sello | público |
| `/mis-tarjetas` | Todas las tarjetas del cliente | público |
| `/privacidad`, `/terminos` | Textos legales (faltan razón social, RUC y correo) | público |
| `/panel` | Resumen: KPI, gráficos, mejores clientes, cumpleaños, listos para canjear, alertas | dueño, gerente |
| `/panel/caja` | Crear código de sello (ticket, monto, cupos), últimos códigos, canjes (`#premios`) | todos |
| `/panel/caja/[id]` | Pantalla en vivo del código: QR, cupos, quién reclamó, anular sello, cancelar, panel de demo | todos (anular: dueño, gerente) |
| `/panel/clientes` | Lista, búsqueda, segmentos, alta manual de cliente | dueño, gerente |
| `/panel/clientes/[id]` | Ficha: tarjeta, historial, notas, canje | dueño, gerente |
| `/panel/clientes/exportar` | CSV de clientes (neutraliza fórmulas) | dueño, gerente |
| `/panel/control` | Antifraude: alertas, equipo vs mediana, códigos, reglas, auditoría | dueño, gerente |
| `/panel/control/exportar` | CSV del registro de actividad | dueño, gerente |
| `/panel/tarjeta` | Editor de tarjeta y reglas con vista previa en vivo y aviso de contraste | dueño, gerente |
| `/panel/tarjeta/poster` | Póster QR imprimible (A4 / A6) | dueño, gerente |
| `/panel/marketing` | Posts para redes: foto real mejorada con IA, ideas con datos del negocio, textos con IA, calendario y reseñas (según plan). Ver `docs/MARKETING.md` | dueño, gerente |
| `/panel/marketing/imagen` | PNG del post con la marca (cuadrado o historia), sin costo de IA | dueño, gerente |
| `/panel/equipo`, `/nuevo`, `/[id]` | Personas, roles, PIN, desactivar (nunca al único dueño) | dueño |
| `/panel/ajustes` | Datos del negocio, sucursales, plan, privacidad | dueño |

Los permisos se definen en `src/lib/nav.ts` y se aplican en servidor con `requireRole` / `hasRole` (`src/lib/auth.ts`) en páginas, route handlers y server actions; ocultar el menú no es la protección.

## Estructura

- `src/lib/contracts.ts`: tipos compartidos (solo se amplía).
- `src/lib/domain/`: reglas puras (cupos, estado del código, antifraude, segmentos) con pruebas.
- `src/lib/repo/`: interfaz `Repo`, implementación en memoria y Supabase. Todo acceso a datos pasa por `getRepo()`.
- `src/lib/context.ts`: `getContext()` devuelve negocio, programa, plantilla y persona activa.
- `src/lib/templates.ts`: vocabulario y valores iniciales por tipo de negocio.
- `src/lib/auth.ts`, `auth-actions.ts`, `session.ts`, `session-token.ts`, `password.ts`: acceso, sesión firmada y contraseñas.
- `src/lib/demo.ts`: `isDemoMode()` (solo herramientas de demostración).
- `src/lib/plans.ts`: planes Básico / Standard / Pro, precios y qué incluye cada uno (`features(plan)`).
- `src/lib/marketing/`, `src/lib/ai/`: módulo de Marketing (ideas, prompts, fotos, cuotas) y clientes de DeepSeek y fal.ai.
- `docs/ARCHITECTURE.md`: capas y reglas de negocio.
- `docs/MARKETING.md`: módulo de Marketing, proveedores de IA, costos y cuotas.

## Cambiar a Supabase

1. Crea el proyecto y aplica `supabase/migrations/0001` a `0008` en orden (`supabase db push`, o el editor SQL). `supabase/seed.sql` es opcional. Detalles en `supabase/README.md`.
2. Define variables de servidor (ver `.env.example`): `STAMPA_REPO=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (p. ej. `https://app.stampaec.app`), `RESEND_API_KEY` y `EMAIL_FROM` (o `STAMPA_EMAIL_PREVIEW=on` mientras no haya clave), y para Marketing `DEEPSEEK_API_KEY` y `FAL_KEY` (Sensitive, sin `NEXT_PUBLIC_`). En producción de Vercel la app se niega a usar el repo en memoria. La service role salta RLS: nunca al navegador.
3. `getRepo()` ya elige la implementación según `STAMPA_REPO`.
4. Crea la cuenta de administrador con `npm run admin:create` y deja `STAMPA_DEMO` apagado. Las cuentas de los dueños se crean desde `/admin`.

## Agregar un tipo de negocio

1. Añade el valor a `BusinessType` en `src/lib/contracts.ts` (solo se amplía).
2. En `src/lib/templates.ts` agrega una entrada en `TEMPLATES` con `label`, `tagline`, `vocab` (visita, cliente, mostrador, ticket, rol), `program` (sellos, premio, monto mínimo, tiempo entre sellos, colores) y `rewardIdeas`.
3. No ramifiques por tipo en la interfaz: todo texto debe salir de `template.vocab`. Los textos de alertas y auditoría que dicen "ticket" se adaptan con `localizeTicket` (`src/lib/format.ts`).
4. Si el tipo no usa monto, pon `requireAmount: false`.

## Falta para producción

- Revocación de sesiones abiertas: la cookie firmada solo vence por tiempo o al desactivar a la persona; cambiar la contraseña no cierra otras sesiones.
- Límites persistentes: el límite por IP y el de correos inexistentes viven en memoria del proceso; el bloqueo por cuenta en Supabase sí es persistente.
- Límite de intentos del PIN de aprobaciones.
- Pruebas del repositorio de Supabase (hoy solo el repo en memoria tiene pruebas) y de las funciones SQL.
- Integración con Apple Wallet y Google Wallet (la vista previa es ilustrativa).
- Cobro de planes: fuera de la app, por WhatsApp (+593 99 091 6553). Vencer el plan no suspende solo: el admin suspende a mano.
- Datos legales en `/privacidad` y `/terminos` (constante `LEGAL` en `src/components/customer/legal.tsx`): razón social, RUC y correo de contacto; confirmar retención de 24 meses y respuesta en 15 días. Cumplimiento de la Ley Orgánica de Protección de Datos Personales de Ecuador (acceso, rectificación y borrado se atienden por correo).
- Fuentes autoalojadas: `app/layout.tsx` carga Sora, Inter y JetBrains Mono desde Google Fonts.
- Pruebas end to end automatizadas (el recorrido con Playwright de esta revisión fue manual y no está en el repositorio).

## Limitaciones conocidas

- Los datos en memoria se pierden al reiniciar el servidor.
- Los textos generados por el sistema (alertas, auditoría) se adaptan al vocabulario solo en la palabra "ticket"; el resto está redactado de forma neutra.
- `next build` necesita red para Google Fonts; sin red muestra una advertencia y usa fuentes del sistema.
- Anular un sello no devuelve el cupo (regla de negocio, no un error); solo dueño y gerente pueden anular.
