/**
 * Crea (o reemplaza la contraseña de) una cuenta del panel de administrador de Stampa (/admin). Lo ejecuta el equipo de Stampa.
 *
 *   STAMPA_REPO=supabase NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run admin:create -- --email administrador@stampa.com [--password "..."]
 *
 * Si falta --password se genera una contraseña aleatoria fuerte y se imprime una sola vez. Si el correo ya existe, se
 * reemplaza su contraseña y se limpian los bloqueos por intentos fallidos. También lee .env.local y .env si existen.
 * Requiere la migración supabase/migrations/0004_mvp.sql (tabla platform_admins).
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { getRepo } from '../src/lib/repo';
import { normalizeEmail, validateEmail } from '../src/lib/credentials';
import { validatePassword } from '../src/lib/password';

for (const f of ['.env.local', '.env']) {
  try { if (existsSync(f)) (process as unknown as { loadEnvFile(p: string): void }).loadEnvFile(f); } catch { /* sin .env */ }
}

function args(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = '';
  }
  return out;
}

const die = (msg: string): never => { console.error(`Error: ${msg}`); process.exit(1); };

async function main() {
  const a = args(process.argv.slice(2));
  if (process.env.STAMPA_REPO !== 'supabase') die('Define STAMPA_REPO=supabase (y NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY). Con el repo en memoria no se guardaría nada.');
  const email = normalizeEmail(a.email);
  const emailErr = validateEmail(email);
  if (emailErr) die(`${emailErr} Usa --email administrador@stampa.com`);
  const generated = !a.password;
  const password = a.password || randomBytes(18).toString('base64url');
  const pwErr = validatePassword(password);
  if (pwErr) die(pwErr);

  const admin = await getRepo().upsertAdmin(email, password);

  console.log('Cuenta de administrador lista.');
  console.log(`  Id:     ${admin.id}`);
  console.log(`  Correo: ${admin.email}`);
  console.log(generated ? `  Contraseña (se muestra solo esta vez): ${password}` : '  Contraseña: la que indicaste con --password');
  console.log('Guárdala en un gestor de contraseñas. Se puede cambiar después desde /admin.');
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
