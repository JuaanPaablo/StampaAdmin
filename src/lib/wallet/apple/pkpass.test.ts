import { createHash, createPublicKey, verify, X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { children, content, oid, pemToDer, readNode, type Node } from './asn1';
import { buildManifest, buildPkpass, crc32, signDetached, zip } from './pkpass';
import { makeTestSigner } from './testing';
import { APPLE_IMAGES } from './images';

/** Lector ZIP mínimo para la prueba: recorre el directorio central y descomprime cada archivo verificando el CRC. */
function unzip(buf: Buffer): Record<string, Buffer> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd).toBeGreaterThan(0);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Record<string, Buffer> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    const plain = method === 8 ? inflateRawSync(data) : Buffer.from(data);
    expect(crc32(plain)).toBe(crc);
    out[name] = plain;
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

const at = (buf: Buffer, n: Node, ...path: number[]): Node => path.reduce((node, i) => children(buf, node)[i], n);

describe('Apple Wallet: .pkpass', () => {
  const signer = makeTestSigner('clave-de-prueba');

  it('CRC32 conocido', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });

  it('el certificado de prueba lo entiende node:crypto', () => {
    const leaf = new X509Certificate(signer.certPem);
    const ca = new X509Certificate(signer.wwdrPem);
    expect(leaf.checkIssued(ca)).toBe(true);
    expect(leaf.verify(ca.publicKey)).toBe(true);
  });

  it('manifest.json con el SHA-1 de cada archivo', () => {
    const m = JSON.parse(buildManifest({ 'pass.json': Buffer.from('{}'), 'icon.png': Buffer.from('x') }).toString());
    expect(m).toEqual({
      'icon.png': createHash('sha1').update('x').digest('hex'),
      'pass.json': createHash('sha1').update('{}').digest('hex')
    });
  });

  it('firma CMS separada: SignedData con SHA-256, signingTime, los dos certificados y firma válida', () => {
    const manifest = Buffer.from('{"pass.json":"abc"}');
    const now = new Date('2026-11-26T15:04:05Z');
    const der = signDetached(manifest, signer, now);
    const root = readNode(der);
    expect(root.end).toBe(der.length);
    const [ctype, wrapped] = children(der, root);
    expect(der.subarray(ctype.start, ctype.end).equals(oid('1.2.840.113549.1.7.2'))).toBe(true);
    const sd = at(der, wrapped, 0);
    const [version, digestAlgs, encap, certs, signerInfos] = children(der, sd);
    expect(content(der, version)[0]).toBe(1);
    expect(der.subarray(digestAlgs.start, digestAlgs.end).includes(oid('2.16.840.1.101.3.4.2.1'))).toBe(true);
    expect(children(der, encap)).toHaveLength(1);                      // sin contenido: separada
    expect(certs.tag).toBe(0xa0);
    const certList = children(der, certs).map((c) => der.subarray(c.start, c.end));
    expect(certList.some((c) => c.equals(pemToDer(signer.certPem)))).toBe(true);
    expect(certList.some((c) => c.equals(pemToDer(signer.wwdrPem)))).toBe(true);

    const si = at(der, signerInfos, 0);
    const parts = children(der, si);
    const attrs = parts[3];
    expect(attrs.tag).toBe(0xa0);
    const attrsDer = Buffer.from(der.subarray(attrs.start, attrs.end));
    expect(attrsDer.includes(oid('1.2.840.113549.1.9.5'))).toBe(true);   // signingTime
    expect(attrsDer.includes(Buffer.from('261126150405Z'))).toBe(true);
    expect(attrsDer.includes(createHash('sha256').update(manifest).digest())).toBe(true);   // messageDigest
    attrsDer[0] = 0x31;                                                 // se firmó como SET
    const signature = content(der, parts[5]);
    expect(verify('sha256', attrsDer, createPublicKey(signer.certPem), signature)).toBe(true);
    expect(verify('sha256', attrsDer, createPublicKey(signer.certPem), Buffer.from(signature).fill(1, 0, 4))).toBe(false);
  });

  it('el zip trae pass.json, imágenes, manifest y signature, y el manifest coincide', () => {
    const files: Record<string, Buffer> = { 'pass.json': Buffer.from(JSON.stringify({ formatVersion: 1 })) };
    for (const [n, b64] of Object.entries(APPLE_IMAGES)) files[n] = Buffer.from(b64, 'base64');
    const out = unzip(buildPkpass(files, signer));
    expect(Object.keys(out).sort()).toEqual([...Object.keys(files), 'manifest.json', 'signature'].sort());
    const manifest = JSON.parse(out['manifest.json'].toString());
    for (const [name, data] of Object.entries(files)) expect(manifest[name]).toBe(createHash('sha1').update(data).digest('hex'));
    expect(out['icon.png'].subarray(1, 4).toString()).toBe('PNG');
  });

  it('zip guarda sin comprimir lo que no ahorra espacio', () => {
    const random = createHash('sha512').update('x').digest();
    expect(unzip(zip([{ name: 'a', data: random }, { name: 'b', data: Buffer.alloc(1000, 65) }]))).toEqual({ a: random, b: Buffer.alloc(1000, 65) });
  });

  const openssl = spawnSync('openssl', ['version'], { encoding: 'utf8' });
  it.skipIf(openssl.status !== 0)('OpenSSL verifica la firma (si está instalado)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkpass-'));
    try {
      const manifest = Buffer.from('{"pass.json":"0123"}');
      writeFileSync(join(dir, 'manifest.json'), manifest);
      writeFileSync(join(dir, 'signature'), signDetached(manifest, signer));
      writeFileSync(join(dir, 'ca.pem'), signer.wwdrPem);
      const r = spawnSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', 'signature', '-content', 'manifest.json',
        '-CAfile', 'ca.pem', '-purpose', 'any', '-out', 'out.txt'], { cwd: dir, encoding: 'utf8' });
      expect(r.stderr).toContain('Verification successful');
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
