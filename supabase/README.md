# Supabase para Stampa

Esquema multi-negocio con RLS y funciones atómicas. Todo el acceso del panel pasa por `src/lib/repo/supabase.ts`
con la service role (servidor); los navegadores nunca hablan con la base directamente.

## Archivos
| Archivo | Qué hace |
|---|---|
| `migrations/0001_schema.sql` | Tablas, claves foráneas, índices, unicidad (`business_id, ticket`) y (`business_id, code` vivo), RLS y permisos de columna. |
| `migrations/0002_functions.sql` | `create_business`, `create_stamp_code`, `claim_stamp_code`, `void_claim`, `cancel_stamp_code`, `redeem_reward`, `verify_staff_pin`, `set_staff_pin`. Mismas reglas y mensajes que `src/lib/domain`. |
| `seed.sql` | Un negocio demo mínimo (Café La Esquina) con PIN 1234 / 2345 / 1111. |

## Aplicar las migraciones

Con la CLI de Supabase (recomendado):

```bash
npm i -g supabase            # o: npx supabase ...
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push             # aplica 0001 y 0002 en orden
psql "$DATABASE_URL" -f supabase/seed.sql   # opcional: datos demo mínimos
```

Sin CLI: abre el editor SQL del proyecto y ejecuta, en este orden, `0001_schema.sql`, `0002_functions.sql` y
(opcional) `seed.sql`. Local: `supabase start` y luego `supabase db reset` aplica migraciones y `seed.sql`.

## Activar el repositorio Supabase en la app

1. Variables de entorno (servidor): `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
   La service role salta RLS: nunca la expongas al navegador ni la uses en componentes de cliente.
2. `STAMPA_REPO=supabase`.
3. `getRepo()` (src/lib/repo/index.ts) debe elegir la implementación según esa variable. Es un cambio de dos líneas que
   queda al integrador, porque ese archivo es compartido:

   ```ts
   import { createSupabaseRepo } from './supabase';
   export function getRepo(): Repo {
     if (!g.__stampaRepo) g.__stampaRepo = process.env.STAMPA_REPO === 'supabase' ? createSupabaseRepo() : createMemoryRepo();
     return g.__stampaRepo;
   }
   ```

## Usuarios del panel (RLS)
Cada persona que inicia sesión con Supabase Auth debe tener una fila en `staff_members (user_id, business_id, staff_id)`.
Las políticas RLS solo dejan leer lo del negocio al que pertenece el usuario autenticado. Escritura directa solo para
dueño y gerente en sucursales, equipo y programa; códigos, sellos, canjes y auditoría solo se modifican con las funciones
de `0002`, que la app invoca con la service role.

## Notas
- Los PIN se guardan con bcrypt (`pgcrypto`). La columna `staff.pin_hash` no se concede a `authenticated`.
- `stamp_codes.live` se apaga al agotarse, cancelarse y, de forma perezosa, al crear un código nuevo si ya venció. Así el
  número de 6 dígitos solo es único entre códigos vivos y puede reciclarse.
- Las alertas no se guardan: se derivan de `stamp_codes`, `stamp_claims` y `rejections` (intentos rechazados).
- Si cambias un mensaje de error en `0002_functions.sql`, cámbialo también en `src/lib/domain/index.ts` y `repo/memory.ts`.
