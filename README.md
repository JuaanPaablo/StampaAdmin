# Stampa Admin

Panel administrativo de Stampa: tarjetas de sellos digitales de fidelización para negocios (restaurantes, cafeterías, gimnasios, floristerías, barberías y más). Un solo panel multi-negocio; el tipo de negocio cambia el vocabulario ("Caja" / "Recepción", "cliente" / "socio" / "comensal", "ticket" / "ficha" / "factura") y los valores iniciales de la tarjeta.

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

Modo demostración (`STAMPA_DEMO`): conmutador de negocio y persona sin PIN, credenciales de prueba en `/ingresar`, panel "Probar en la demo" en cada código y acceso sin sesión al negocio demo. Está activo en `npm run dev` y apagado en `npm start`; para una demo desplegada usa `STAMPA_DEMO=on`. Con el modo apagado, sin sesión válida todo redirige a `/ingresar`.

### Credenciales de demostración

| Rol | PIN |
|---|---|
| Dueño | 1234 |
| Gerente | 2345 |
| Cajeros | 1111 |

Negocios: `biz_esquina` (cafetería, predeterminado), `biz_pulso` (gimnasio, sin monto), `biz_petalo` (floristería), `biz_mesa` (restaurante), `biz_donlucho` (barbería). Los nombres de cada equipo salen en `/ingresar`. Cookies de sesión: `stampa_biz` y `stampa_staff`.

## Mapa de rutas

| Ruta | Qué hace | Roles |
|---|---|---|
| `/ingresar` | Acceso por negocio, persona y PIN de 4 dígitos | público |
| `/registro` | Alta de negocio en 3 pasos (tipo, datos, vista previa) | público |
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
| `/panel/equipo`, `/nuevo`, `/[id]` | Personas, roles, PIN, desactivar (nunca al único dueño) | dueño |
| `/panel/ajustes` | Datos del negocio, sucursales, plan, privacidad | dueño |

Los permisos se definen en `src/lib/nav.ts` y se aplican en servidor con `requireRole` / `hasRole` (`src/lib/auth.ts`) en páginas, route handlers y server actions; ocultar el menú no es la protección.

## Estructura

- `src/lib/contracts.ts`: tipos compartidos (solo se amplía).
- `src/lib/domain/`: reglas puras (cupos, estado del código, antifraude, segmentos) con pruebas.
- `src/lib/repo/`: interfaz `Repo`, implementación en memoria y Supabase. Todo acceso a datos pasa por `getRepo()`.
- `src/lib/context.ts`: `getContext()` devuelve negocio, programa, plantilla y persona activa.
- `src/lib/templates.ts`: vocabulario y valores iniciales por tipo de negocio.
- `src/lib/demo.ts`: `isDemoMode()`.
- `docs/ARCHITECTURE.md`: capas y reglas de negocio.

## Cambiar a Supabase

1. Crea el proyecto y aplica `supabase/migrations/0001_schema.sql` y `0002_functions.sql` en orden (`supabase db push`, o el editor SQL). `supabase/seed.sql` es opcional. Detalles en `supabase/README.md`.
2. Define variables de servidor (ver `.env.example`): `STAMPA_REPO=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. La service role salta RLS: nunca al navegador.
3. `getRepo()` ya elige la implementación según `STAMPA_REPO`.
4. Reemplaza la sesión de cookies por Supabase Auth (ver "Falta para producción") y deja `STAMPA_DEMO` apagado.

## Agregar un tipo de negocio

1. Añade el valor a `BusinessType` en `src/lib/contracts.ts` (solo se amplía).
2. En `src/lib/templates.ts` agrega una entrada en `TEMPLATES` con `label`, `tagline`, `vocab` (visita, cliente, mostrador, ticket, rol), `program` (sellos, premio, monto mínimo, tiempo entre sellos, colores) y `rewardIdeas`.
3. No ramifiques por tipo en la interfaz: todo texto debe salir de `template.vocab`. Los textos de alertas y auditoría que dicen "ticket" se adaptan con `localizeTicket` (`src/lib/format.ts`).
4. Si el tipo no usa monto, pon `requireAmount: false`.

## Falta para producción

- Autenticación real con Supabase Auth (hoy la sesión son dos cookies sin firma) y sesión por usuario.
- Límite de intentos de PIN persistente: el actual vive en memoria del proceso y se pierde al reiniciar o con varias instancias.
- Pruebas del repositorio de Supabase (hoy solo el repo en memoria tiene pruebas) y de las funciones SQL.
- Escáner del cliente y página pública de alta `/u/<slug>`: el QR del póster y del código apuntan a `stampa.example`, que es un marcador.
- Integración con Apple Wallet y Google Wallet (la vista previa es ilustrativa).
- Facturación de planes (la pantalla de plan es informativa).
- Políticas de privacidad, términos, y cumplimiento de la Ley Orgánica de Protección de Datos Personales de Ecuador (consentimiento, acceso, rectificación y borrado; la exportación de datos de clientes desde Ajustes está pendiente).
- Fuentes autoalojadas: `app/layout.tsx` carga Sora, Inter y JetBrains Mono desde Google Fonts.
- Pruebas end to end automatizadas (el recorrido con Playwright de esta revisión fue manual y no está en el repositorio).

## Limitaciones conocidas

- La sesión de demostración no está firmada: quien edite las cookies `stampa_biz` y `stampa_staff` puede elegir un negocio y una persona. Hay una defensa parcial: si la persona no pertenece al negocio de la cookie, o está desactivada, la sesión se invalida y se redirige a `/ingresar`. Es una limitación documentada, no un diseño final.
- Los datos en memoria se pierden al reiniciar el servidor.
- Los textos generados por el sistema (alertas, auditoría) se adaptan al vocabulario solo en la palabra "ticket"; el resto está redactado de forma neutra.
- `next build` necesita red para Google Fonts; sin red muestra una advertencia y usa fuentes del sistema.
- Anular un sello no devuelve el cupo (regla de negocio, no un error); solo dueño y gerente pueden anular.
