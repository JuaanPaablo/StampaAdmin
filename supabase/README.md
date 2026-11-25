# Supabase para Stampa

Esquema multi-negocio con RLS y funciones atómicas. Todo el acceso del panel pasa por `src/lib/repo/supabase.ts`
con la service role (servidor); los navegadores nunca hablan con la base directamente.

## Archivos
| Archivo | Qué hace |
|---|---|
| `migrations/0001_schema.sql` | Tablas, claves foráneas, índices, unicidad (`business_id, ticket`) y (`business_id, code` vivo), RLS y permisos de columna. |
| `migrations/0002_functions.sql` | `create_business`, `create_stamp_code`, `claim_stamp_code`, `void_claim`, `cancel_stamp_code`, `redeem_reward`, `verify_staff_pin`, `set_staff_pin`. Mismas reglas y mensajes que `src/lib/domain`. |
| `migrations/0003_auth.sql` | Acceso al panel con correo + contraseña: columnas `staff.email/password_hash/...`, `auth_lookup`, `auth_record_failure`, `auth_record_success`. |
| `migrations/0004_mvp.sql` | MVP: estado y plan de los negocios (`status`, `plan_expires_at`, `suspended_at`, `setup_completed_at`, `admin_note`), `programs.cover_url`, `customers.birthday_y/email_verified_at`, `staff.has_password`; tablas `platform_admins`, `access_tokens`, `email_otps`; funciones `create_business_access`, `issue_access_token`, `peek_access_token`, `consume_access_token`, `set_staff_email`, `request_email_otp`, `verify_email_otp`, `admin_record_failure/success`, `admin_business_stats`, `platform_stats`; `claim_stamp_code` rechaza negocios que no están activos; bucket público `branding`. |
| `migrations/0009_admin_insights.sql` | Panel de administrador: `businesses.owner_phone`, tablas `admin_payments` y `admin_actions` (RLS sin políticas), `admin_business_stats` ampliada, `admin_series`, `admin_ai_usage`, `admin_record_payment`. |
| `demo/admin_demo_seed.sql`, `demo/admin_demo_clean.sql` | Datos inventados del panel de administrador (negocios `demo_biz_*`) y su limpieza. Requieren 0009. |
| `seed.sql` | Un negocio demo mínimo (Café La Esquina) con PIN 1234 / 2345 / 1111. |

## Aplicar las migraciones

Con la CLI de Supabase (recomendado):

```bash
npm i -g supabase            # o: npx supabase ...
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push             # aplica 0001, 0002, 0003 y 0004 en orden
psql "$DATABASE_URL" -f supabase/seed.sql   # opcional: datos demo mínimos
```

Sin CLI: abre el editor SQL del proyecto y ejecuta, en este orden, `0001_schema.sql`, `0002_functions.sql`,
`0003_auth.sql`, `0004_mvp.sql` y (opcional) `seed.sql`. `0004` es idempotente: se puede volver a ejecutar. Local: `supabase start` y luego `supabase db reset` aplica migraciones y `seed.sql`.

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

## Crear la cuenta del administrador de Stampa

El panel `/admin` usa su propia tabla (`platform_admins`), aparte del equipo de los negocios. Con `0004` aplicada y las
variables de entorno de servidor definidas (también se leen de `.env.local`):

```bash
STAMPA_REPO=supabase npm run admin:create -- --email administrador@stampa.com
# o con una contraseña elegida (mínimo 10 caracteres):
STAMPA_REPO=supabase npm run admin:create -- --email administrador@stampa.com --password "..."
```

Sin `--password` se genera una contraseña aleatoria fuerte y se imprime UNA sola vez. Volver a ejecutarlo con el mismo
correo reemplaza la contraseña y quita el bloqueo por intentos fallidos. Las cuentas de dueños se crean desde `/admin`
(invitación); para casos especiales sigue existiendo `npm run account:create`.

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
- Si cambias un mensaje de error en `0002_functions.sql` o `0004_mvp.sql`, cámbialo también en `src/lib/domain` y `repo/memory.ts`.
- Enlaces de invitación/restablecer y códigos de 6 dígitos se guardan solo como hash SHA-256 (`src/lib/tokens.ts`); la base
  compara hashes. `platform_admins`, `access_tokens` y `email_otps` tienen RLS sin políticas y nada concedido a
  `anon`/`authenticated`: solo las usa la service role.
- Bucket `branding` (público, 2 MB, png/jpeg/webp): la app sube `branding/<businessId>/<logo|cover>-<timestamp>.<ext>` con
  la service role y guarda la URL pública en `programs.logo_url` / `programs.cover_url`.
- `businesses.admin_note` es una nota interna de Stampa. La app la lee solo con la service role, pero la política
  `businesses_read` de `0001` deja a un miembro autenticado leer toda la fila de su negocio: si algún día el navegador
  consulta la base directamente, conviene pasar esa nota a una tabla aparte o restringir columnas.
