# Stampa Admin: arquitectura y reparto de módulos

Panel administrativo multi-negocio para dueños de restaurantes, cafeterías, gimnasios, floristerías, barberías y cualquier negocio que quiera una tarjeta de sellos digital. Español de Ecuador (USD).

## Stack
Next.js 14 (App Router, server components, server actions) · TypeScript estricto · Tailwind · Supabase (Postgres con RLS) · Vitest.
Sin servicios externos en tiempo de ejecución para desarrollo: la app corre con un repositorio en memoria con datos de ejemplo (`src/lib/repo/memory.ts`). Producción usa `src/lib/repo/supabase.ts` con el mismo contrato.

## Capas (de abajo hacia arriba)
1. `src/lib/contracts.ts`: tipos compartidos. Solo se agregan cosas, nunca se renombra ni se borra.
2. `src/lib/domain/`: reglas puras (cupos, estado del código, antifraude, segmentos). Sin base de datos. Probadas con vitest.
3. `src/lib/repo/`: interfaz `Repo` (index.ts), implementación en memoria y esqueleto de Supabase. Todo acceso a datos pasa por `getRepo()`.
4. `src/lib/context.ts`: `getContext()` devuelve `{ repo, business, program, template, staff }` para el negocio activo. Toda página del panel empieza con eso.
5. `src/lib/templates.ts`: vocabulario y valores iniciales por tipo de negocio. Ningún texto de interfaz debe asumir "cafetería": usa `template.vocab`.
6. Páginas bajo `src/app/panel/**` y componentes bajo `src/components/<módulo>/`.

## Multi-negocio
- Cada fila de datos lleva `businessId`; en Supabase se aísla con RLS por `business_id` del staff autenticado.
- El tipo de negocio cambia vocabulario, valores por defecto y reglas (por ejemplo, un gimnasio no pide monto: `program.requireAmount = false`).
- El panel es el mismo para todos; nunca ramifiques por tipo de negocio en la interfaz, usa la plantilla.

## Reparto (propiedad exclusiva de archivos)
| Agente | Es dueño de | No toca |
|---|---|---|
| A · Datos y reglas | `src/lib/domain/**`, `src/lib/repo/memory.ts`, `src/lib/repo/supabase.ts`, `supabase/**`, `src/lib/seed.ts` | páginas y componentes |
| B · Acceso, onboarding y shell | `src/app/panel/layout.tsx`, `src/app/panel/loading.tsx`, `src/app/panel/error.tsx`, `src/app/ingresar/**`, `src/app/registro/**`, `src/app/panel/ajustes/**`, `src/components/shell/**`, `src/lib/auth.ts` | módulos de otros |
| C · Resumen y clientes | `src/app/panel/page.tsx`, `src/app/panel/clientes/**`, `src/components/dashboard/**`, `src/components/customers/**` | |
| D · Caja y control antifraude | `src/app/panel/caja/**`, `src/app/panel/control/**`, `src/components/register/**`, `src/components/control/**` | |
| E · Tarjeta y equipo | `src/app/panel/tarjeta/**`, `src/app/panel/equipo/**`, `src/components/card/**`, `src/components/team/**` | |

Reglas de convivencia:
- Nadie edita archivos de otro agente. Si necesitas un cambio en un archivo ajeno, descríbelo en tu informe final.
- Archivos compartidos (`contracts.ts`, `repo/index.ts`, `templates.ts`, `nav.ts`, `components/ui/index.tsx`, `format.ts`): solo se pueden AGREGAR exports. Nunca cambies firmas existentes.
- Acciones de servidor en `actions.ts` dentro de la carpeta de tu ruta. Valida con zod y devuelve `{ ok, error }`; no lances errores para casos esperados.
- Cada ruta con datos define `loading.tsx` o muestra un estado vacío útil. Textos en español, sin emojis, voz directa.
- Diseño: panel claro, barra lateral Azul Noche (la dibuja B), amarillo solo para acciones principales. Responsive hasta 390 px de ancho.
- Accesibilidad: etiquetas en todos los campos, foco visible, tablas con encabezados, contraste AA.

## Reglas de negocio clave (las implementa A, las consumen todos)
- Un ticket genera un solo código. El código se quema al llenarse los cupos, al vencer o al cancelarse.
- Cupos máximos = monto ÷ mínimo por sello (si `requireAmount`). Más de `maxSeatsWithoutApproval` cupos exige PIN de dueño o gerente.
- Un cliente reclama un cupo por código. Anular un sello no devuelve el cupo.
- Antifraude por cajero: sellos por ticket frente a la mediana del equipo (`flagStaff`). Alertas de código compartido (intentos tras quemarse), aprobaciones, anulaciones y tickets repetidos.
- Segmentos de cliente: nuevo, activo, en riesgo, inactivo, por canjear.

## Comandos
`npm run dev` · `npm run typecheck` · `npm run build` · `npm test`
