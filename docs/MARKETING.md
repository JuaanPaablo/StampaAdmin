# Módulo de Marketing

Ruta: `/panel/marketing` (dueño y gerente). Ayuda al negocio a publicar en sus redes posts que se puedan subir tal
cual: **su foto real mejorada**, su marca y un texto que vende. El dueño siempre revisa, edita, copia y publica.

## Flujo

1. **Tu foto.** El dueño sube una foto real (plato, local, producto) o usa la portada de su tarjeta. El navegador la
   reduce a 1600 px en JPG antes de subirla. Se guarda en el bucket `branding`, carpeta `<negocio>/marketing/`.
2. **¿Cómo la mejoramos?** Cuatro estilos con instrucciones fijas (`src/lib/marketing/photos.ts`):
   retoque profesional, con ambiente, fondo limpio y de temporada (Navidad, San Valentín, Día de la Madre…).
   Stampa recomienda estilos según el tipo de negocio y la fecha, sin IA y sin costo.
   La IA **mejora** la foto, nunca inventa el producto: todas las instrucciones exigen conservarlo idéntico y no
   agregar texto. La original se conserva; el resultado se guarda como foto nueva y se muestra antes/después.
3. **Tu texto.** Ideas con los datos del negocio (día flojo, hora pico, premios entregados, clientes que no vuelven,
   cumpleaños, nuevos), post libre, semana de posts (Pro) y respuestas a reseñas de Google (Pro). Cada generación
   devuelve 3 opciones con título, subtítulo, texto y hashtags.
4. **Imagen final.** `/panel/marketing/imagen` dibuja el PNG con next/og: con foto (impacto, con marco, dividido,
   limpio) o sin foto (tus colores, claro, cifra grande), en cuadrado (feed) o vertical (historia). No usa IA.

## Proveedores de IA

| Uso | Proveedor | Modelo | Costo aprox. | Variable |
|---|---|---|---|---|
| Textos | DeepSeek | `deepseek-flash`, sin modo de razonamiento, JSON | < US$0,001 por generación (~500 tokens de entrada, ~650 de salida) | `DEEPSEEK_API_KEY` (opcional `DEEPSEEK_MODEL`) |
| Fotos | fal.ai | `fal-ai/bytedance/seedream/v5/lite/edit` | ~US$0,035 por foto | `FAL_KEY` (opcional `FAL_IMAGE_MODEL`) |

- DeepSeek **no** genera ni edita imágenes (su API es solo de texto); por eso las fotos usan fal.ai.
- El mensaje de sistema de DeepSeek es idéntico en todas las llamadas para aprovechar su caché (más barato).
- Con `FAL_IMAGE_MODEL` se puede cambiar de modelo sin tocar código (p. ej. `fal-ai/flux-pro/kontext`, ~US$0,04).
- Las URL que devuelve fal caducan: el resultado se descarga y se guarda en Supabase Storage.
- Las claves son variables de servidor (Sensitive en Vercel). Nunca con prefijo `NEXT_PUBLIC_`.
- Sin clave, en desarrollo se usan textos de ejemplo y la "mejora" copia la foto, para probar sin gastar saldo.
  En producción se muestra un aviso.

## Cuotas por plan (mensuales, se renuevan el día 1 en la zona horaria del negocio)

| | Básico | Standard | Pro |
|---|---|---|---|
| Textos con IA | 10 | 40 | 120 |
| Fotos mejoradas con IA | 5 | 20 | 60 |
| Ideas con tus datos | no | sí | sí |
| Semana de posts y reseñas | no | no | sí |

Costo máximo de IA por negocio al mes (aprox.): Básico US$0,19, Standard US$0,74, Pro US$2,22.
Además hay un freno de velocidad (4 textos o 3 fotos por minuto). Las respuestas incompletas no descuentan.

## Registro y costos

Cada generación queda en `public.marketing_generations` (tipo, modelo, tokens, caché, quién la hizo). El panel de
administrador muestra el uso del mes en el detalle de cada negocio. Solo el servidor lee la tabla (RLS sin políticas).

## Archivos

- `src/lib/marketing/insights.ts`: ideas con datos (sin IA).
- `src/lib/marketing/prompts.ts`: instrucciones y lectura segura de las respuestas de DeepSeek.
- `src/lib/marketing/photos.ts`: estilos de foto, recomendaciones, validación e ids.
- `src/lib/marketing/service.ts`: cuotas, generación de textos y mejora de fotos.
- `src/lib/ai/deepseek.ts`, `src/lib/ai/fal.ts`: clientes de los proveedores.
- `src/app/panel/marketing/`: página, server actions y ruta de la imagen.
- `src/components/marketing/`: `MarketingStudio` y `PhotoPanel`.
- Migraciones: `0007_plans_marketing.sql`, `0008_marketing_photos.sql`.

## Limitaciones conocidas

- En Windows, `next dev` no puede dibujar las imágenes (bug de rutas de next/og en Next 14). En Vercel funciona.
- La IA no ve la foto antes de mejorarla: las recomendaciones dependen del tipo de negocio y la fecha.
