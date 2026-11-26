/**
 * Arma un .pkpass de ejemplo con certificados de PRUEBA (no sirve en un iPhone: solo para revisar la firma y el zip).
 * Uso: npx tsx scripts/apple-pkpass-sample.ts <cert.pem> <key.pem> <wwdr.pem> <salida.pkpass> [contraseña]
 * Lo llama scripts/apple-pkpass-check.sh.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPkpass } from '../src/lib/wallet/apple/pkpass';
import { APPLE_IMAGES } from '../src/lib/wallet/apple/images';

const [certPath, keyPath, wwdrPath, out, keyPassword] = process.argv.slice(2);
if (!certPath || !keyPath || !wwdrPath || !out) {
  console.error('Uso: npx tsx scripts/apple-pkpass-sample.ts <cert.pem> <key.pem> <wwdr.pem> <salida.pkpass> [contraseña]');
  process.exit(1);
}
const pass = {
  formatVersion: 1, passTypeIdentifier: 'pass.app.stampa.prueba', teamIdentifier: 'AB12CD34EF', serialNumber: 's.biz_prueba.cli_prueba',
  organizationName: 'Prueba', description: 'Tarjeta de prueba', storeCard: { primaryFields: [{ key: 'p', label: 'SELLOS', value: '3 de 10' }] }
};
const files: Record<string, Buffer> = { 'pass.json': Buffer.from(JSON.stringify(pass)) };
for (const [n, b64] of Object.entries(APPLE_IMAGES)) files[n] = Buffer.from(b64, 'base64');
writeFileSync(out, buildPkpass(files, {
  certPem: readFileSync(certPath, 'utf8'), keyPem: readFileSync(keyPath, 'utf8'), wwdrPem: readFileSync(wwdrPath, 'utf8'), keyPassword
}));
console.log(`Listo: ${out}`);
