/**
 * ASN.1 DER mínimo (sin dependencias) para armar la firma PKCS#7/CMS del .pkpass y leer lo justo de un certificado
 * X.509 (emisor y número de serie). Solo lo que hace falta aquí: no es un codificador general.
 */

export type Der = Buffer;

function lengthBytes(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** TLV con la etiqueta (un byte) y el contenido ya codificado. */
export function tlv(tag: number, content: Buffer): Der {
  return Buffer.concat([Buffer.from([tag]), lengthBytes(content.length), content]);
}

export const seq = (...items: Der[]): Der => tlv(0x30, Buffer.concat(items));
/** SET OF en DER: los elementos van ordenados por su codificación. */
export const set = (...items: Der[]): Der => tlv(0x31, Buffer.concat([...items].sort(Buffer.compare)));
export const nul = (): Der => Buffer.from([0x05, 0x00]);
export const octets = (b: Buffer): Der => tlv(0x04, b);
export const utf8 = (s: string): Der => tlv(0x0c, Buffer.from(s, 'utf8'));
export const printable = (s: string): Der => tlv(0x13, Buffer.from(s, 'ascii'));
/** BIT STRING sin bits sobrantes. */
export const bits = (b: Buffer): Der => tlv(0x03, Buffer.concat([Buffer.from([0]), b]));
/** [n] EXPLICIT (construido). */
export const explicit = (n: number, inner: Der): Der => tlv(0xa0 | n, inner);
/** [n] IMPLICIT construido: reemplaza la etiqueta de un SET/SEQUENCE ya codificado. */
export const implicitConstructed = (n: number, encoded: Der): Der => Buffer.concat([Buffer.from([0xa0 | n]), encoded.subarray(1)]);

export function integer(v: number | bigint | Buffer): Der {
  let b: Buffer;
  if (Buffer.isBuffer(v)) b = v;
  else {
    let n = BigInt(v);
    if (n < 0n) throw new Error('integer: solo positivos');
    const bytes: number[] = [];
    do { bytes.unshift(Number(n & 0xffn)); n >>= 8n; } while (n > 0n);
    b = Buffer.from(bytes);
  }
  let i = 0;
  while (i < b.length - 1 && b[i] === 0 && !(b[i + 1] & 0x80)) i++;   // sin ceros de más a la izquierda
  b = b.subarray(i);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);           // positivo
  return tlv(0x02, b);
}

export function oid(dotted: string): Der {
  const parts = dotted.split('.').map(Number);
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const chunk: number[] = [];
    let v = p;
    do { chunk.unshift(v & 0x7f); v = Math.floor(v / 128); } while (v > 0);
    for (let i = 0; i < chunk.length - 1; i++) chunk[i] |= 0x80;
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
}

const pad = (n: number) => String(n).padStart(2, '0');
/** UTCTime (años 1950-2049) en UTC: YYMMDDHHMMSSZ. */
export function utcTime(d: Date): Der {
  const s = `${pad(d.getUTCFullYear() % 100)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return tlv(0x17, Buffer.from(s, 'ascii'));
}

/* ---------- Lectura mínima ---------- */

export interface Node { tag: number; start: number; headerLength: number; length: number; end: number }

/** Lee el TLV que empieza en `offset`. */
export function readNode(buf: Buffer, offset = 0): Node {
  if (offset + 2 > buf.length) throw new Error('DER truncado');
  const tag = buf[offset];
  let len = buf[offset + 1];
  let header = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || offset + 2 + n > buf.length) throw new Error('DER: largo inválido');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[offset + 2 + i];
    header += n;
  }
  const end = offset + header + len;
  if (end > buf.length) throw new Error('DER truncado');
  return { tag, start: offset, headerLength: header, length: len, end };
}

/** Hijos directos de un nodo construido. */
export function children(buf: Buffer, node: Node): Node[] {
  const out: Node[] = [];
  for (let p = node.start + node.headerLength; p < node.end; ) {
    const c = readNode(buf, p);
    out.push(c);
    p = c.end;
  }
  return out;
}

export const raw = (buf: Buffer, n: Node): Buffer => buf.subarray(n.start, n.end);
export const content = (buf: Buffer, n: Node): Buffer => buf.subarray(n.start + n.headerLength, n.end);

/** PEM → DER del primer bloque con ese tipo ("CERTIFICATE"). */
export function pemToDer(pem: string, label = 'CERTIFICATE'): Buffer {
  const m = pem.match(new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`));
  if (!m) throw new Error(`PEM sin ${label}`);
  return Buffer.from(m[1].replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
}

/**
 * Emisor (Name, DER tal cual) y número de serie (INTEGER, DER tal cual) de un certificado X.509: es lo que va en
 * IssuerAndSerialNumber del SignerInfo.
 */
export function certIssuerAndSerial(certDer: Buffer): { issuer: Buffer; serial: Buffer } {
  const cert = readNode(certDer, 0);
  const [tbs] = children(certDer, cert);
  const parts = children(certDer, tbs);
  let i = 0;
  if (parts[0]?.tag === 0xa0) i = 1;                    // [0] version (opcional)
  const serial = parts[i];
  const issuer = parts[i + 2];                          // serial, signature, issuer
  if (!serial || serial.tag !== 0x02 || !issuer || issuer.tag !== 0x30) throw new Error('Certificado X.509 inválido');
  return { issuer: raw(certDer, issuer), serial: raw(certDer, serial) };
}
