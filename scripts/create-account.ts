/**
 * Crea (o actualiza) la cuenta de acceso de una persona del equipo de un negocio. Lo ejecuta el equipo de Stampa.
 *
 *   STAMPA_REPO=supabase NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/create-account.ts --business biz_esquina --name "Andrea Zambrano" --role owner --email andrea@cafe.com
 *
 * Opciones: --business (id o slug), --name, --role (owner|manager|cashier), --email, --password (opcional; si falta se genera una
 * contraseña aleatoria fuerte y se imprime una sola vez), --staff <id> (para ponerle credenciales a una persona que ya existe).
 * También lee .env.local y .env si existen.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { getRepo } from '../src/lib/repo';
import { validateEmail, normalizeEmail } from '../src/lib/credentials';
import { validatePassword } from '../src/lib/password';
import type { Role } from '../src/lib/contracts';

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
  if (emailErr) die(emailErr);
  const generated = !a.password;
  const password = a.password || randomBytes(18).toString('base64url');
  const pwErr = validatePassword(password);
  if (pwErr) die(pwErr);

  const repo = getRepo();
  const businesses = await repo.listBusinesses();
  let staffId = a.staff;
  let createdId: string | undefined;
  let business = a.business ? businesses.find((b) => b.id === a.business || b.slug === a.business) : undefined;

  if (staffId) {
    for (const b of businesses) if ((await repo.listStaff(b.id)).some((s) => s.id === staffId)) business = b;
    if (!business) die(`No encontramos a la persona ${staffId}.`);
  } else {
    if (!a.business) die('Falta --business (id o slug).');
    if (!business) die(`No existe el negocio "${a.business}". Disponibles: ${businesses.map((b) => `${b.id} (${b.slug})`).join(', ') || 'ninguno'}.`);
    if (!a.name) die('Falta --name.');
    if (!['owner', 'manager', 'cashier'].includes(a.role)) die('--role debe ser owner, manager o cashier.');
    const created = await repo.upsertStaff(business!.id, { name: a.name, role: a.role as Role });
    staffId = createdId = created.id;
  }

  try {
    await repo.setStaffCredentials(staffId!, email, password);
  } catch (e) {
    if (createdId) { try { await repo.upsertStaff(business!.id, { id: createdId, name: a.name, role: a.role as Role, active: false }); } catch { /* sin limpieza */ } }
    die(e instanceof Error ? e.message : 'No se pudo guardar la cuenta.');
  }

  console.log(`Cuenta lista en ${business!.name} (${business!.id}).`);
  console.log(`  Persona: ${staffId}`);
  console.log(`  Correo:  ${email}`);
  console.log(generated ? `  Contraseña (se muestra solo esta vez): ${password}` : '  Contraseña: la que indicaste con --password');
  console.log('Compártela por un canal seguro y pide que la cambie cuando esté disponible.');
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
