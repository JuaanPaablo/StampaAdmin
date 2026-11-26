import { createHash, createPrivateKey, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { certIssuerAndSerial, explicit, implicitConstructed, integer, nul, octets, oid, pemToDer, seq, set, utcTime } from './asn1';

/**
 * Archivo .pkpass de Apple Wallet, hecho a mano con node:crypto y node:zlib (sin dependencias):
 *
 *   pass.json + imágenes → manifest.json ({ archivo: SHA-1 hex }) → signature (PKCS#7/CMS SignedData separada, DER,
 *   firmada con el certificado del Pass Type ID, incluye el intermedio WWDR, con signingTime y digest SHA-256)
 *   → todo en un ZIP.
 *
 * Verificación manual con OpenSSL: scripts/apple-pkpass-check.sh.
 */

export interface PassSigner {
  certPem: string;
  keyPem: string;
  keyPassword?: string;
  wwdrPem: string;
}

const OID = {
  data: '1.2.840.113549.1.7.1',
  signedData: '1.2.840.113549.1.7.2',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsaEncryption: '1.2.840.113549.1.1.1',
  ecdsaWithSha256: '1.2.840.10045.4.3.2'
};

const sha1Hex = (b: Buffer) => createHash('sha1').update(b).digest('hex');

/** manifest.json: SHA-1 en hexadecimal de cada archivo del pase (todo menos manifest y signature). */
export function buildManifest(files: Record<string, Buffer>): Buffer {
  const out: Record<string, string> = {};
  for (const name of Object.keys(files).sort()) out[name] = sha1Hex(files[name]);
  return Buffer.from(JSON.stringify(out), 'utf8');
}

const keyCache = new Map<string, KeyObject>();
function privateKey(pem: string, passphrase?: string): KeyObject {
  const id = createHash('sha256').update(pem).update('\0').update(passphrase ?? '').digest('hex');
  let k = keyCache.get(id);
  if (!k) {
    k = createPrivateKey(passphrase ? { key: pem, format: 'pem', passphrase } : { key: pem, format: 'pem' });
    keyCache.set(id, k);
  }
  return k;
}

/**
 * Firma separada (detached) PKCS#7/CMS en DER sobre `content` (el manifest.json). Lo que Apple pide para `signature`.
 */
export function signDetached(content: Buffer, signer: PassSigner, now: Date = new Date()): Buffer {
  const certDer = pemToDer(signer.certPem);
  const wwdrDer = pemToDer(signer.wwdrPem);
  const key = privateKey(signer.keyPem, signer.keyPassword);
  const { issuer, serial } = certIssuerAndSerial(certDer);
  const sha256Alg = seq(oid(OID.sha256), nul());
  const isEc = key.asymmetricKeyType === 'ec';
  if (!isEc && key.asymmetricKeyType !== 'rsa') throw new Error('La clave del pase debe ser RSA o EC.');

  const attrs = [
    seq(oid(OID.contentType), set(oid(OID.data))),
    seq(oid(OID.signingTime), set(utcTime(now))),
    seq(oid(OID.messageDigest), set(octets(createHash('sha256').update(content).digest())))
  ];
  const signedAttrsSet = set(...attrs);                       // se firma con etiqueta SET (0x31)…
  const signature = cryptoSign('sha256', signedAttrsSet, key);
  const signerInfo = seq(
    integer(1),
    seq(issuer, serial),                                      // IssuerAndSerialNumber
    sha256Alg,
    implicitConstructed(0, signedAttrsSet),                   // …y se guarda como [0] IMPLICIT
    isEc ? seq(oid(OID.ecdsaWithSha256)) : seq(oid(OID.rsaEncryption), nul()),
    octets(signature)
  );
  const signedData = seq(
    integer(1),
    set(sha256Alg),
    seq(oid(OID.data)),                                       // encapContentInfo sin contenido: firma separada
    implicitConstructed(0, set(certDer, wwdrDer)),            // certificates [0] IMPLICIT
    set(signerInfo)
  );
  return seq(oid(OID.signedData), explicit(0, signedData));
}

/* ---------- ZIP ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((Math.max(1980, d.getUTCFullYear()) - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate()
  };
}

/** ZIP clásico (sin ZIP64). Comprime con deflate si ahorra espacio; si no, guarda tal cual. */
export function zip(files: { name: string; data: Buffer }[], now: Date = new Date()): Buffer {
  const { time, date } = dosDateTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data);
    const deflated = deflateRawSync(f.data, { level: 9 });
    const useDeflate = deflated.length < f.data.length;
    const body = useDeflate ? deflated : f.data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);                 // versión necesaria
    local.writeUInt16LE(0x0800, 6);             // nombres en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);               // hecho por
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);          // extra, comentario, disco, atributos en 0
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* ---------- .pkpass ---------- */

/**
 * Arma el .pkpass: `files` = pass.json + imágenes (nombre → bytes). Agrega manifest.json y signature.
 */
export function buildPkpass(files: Record<string, Buffer>, signer: PassSigner, now: Date = new Date()): Buffer {
  if (!files['pass.json']) throw new Error('Falta pass.json');
  const manifest = buildManifest(files);
  const signature = signDetached(manifest, signer, now);
  const entries = Object.keys(files).sort().map((name) => ({ name, data: files[name] }));
  return zip([...entries, { name: 'manifest.json', data: manifest }, { name: 'signature', data: signature }], now);
}
