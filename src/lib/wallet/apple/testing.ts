import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { bits, explicit, integer, nul, oid, printable, seq, set, tlv, utcTime, utf8 } from './asn1';

/**
 * SOLO PARA PRUEBAS: certificados X.509 desechables (una "CA" que hace de WWDR y un certificado de pase firmado por
 * ella), armados con el mismo codificador DER. Nunca se usa en producción.
 */

const name = (cn: string) => seq(set(seq(oid('2.5.4.6'), printable('EC'))), set(seq(oid('2.5.4.3'), utf8(cn))));
const sha256WithRsa = () => seq(oid('1.2.840.113549.1.1.11'), nul());

function certificate(subject: string, issuer: string, serial: number, publicKey: KeyObject, signerKey: KeyObject, ca: boolean): string {
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const now = Date.now();
  const basicConstraints = seq(oid('2.5.29.19'), tlv(0x01, Buffer.from([0xff])), tlv(0x04, seq(...(ca ? [tlv(0x01, Buffer.from([0xff]))] : []))));
  const tbs = seq(
    explicit(0, integer(2)),
    integer(serial),
    sha256WithRsa(),
    name(issuer),
    seq(utcTime(new Date(now - 86_400_000)), utcTime(new Date(now + 365 * 86_400_000))),
    name(subject),
    spki,
    explicit(3, seq(basicConstraints))
  );
  const cert = seq(tbs, sha256WithRsa(), bits(sign('sha256', tbs, signerKey)));
  return `-----BEGIN CERTIFICATE-----\n${cert.toString('base64').replace(/.{64}/g, '$&\n')}\n-----END CERTIFICATE-----\n`;
}

export interface TestSigner { certPem: string; keyPem: string; wwdrPem: string; keyPassword?: string }

/** CA de prueba + certificado de pase firmado por ella (RSA 2048). Con `password`, la clave va cifrada. */
export function makeTestSigner(password?: string): TestSigner {
  const ca = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const leaf = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wwdrPem = certificate('Prueba WWDR', 'Prueba WWDR', 1, ca.publicKey, ca.privateKey, true);
  const certPem = certificate('Pass Type ID: pass.app.stampa.prueba', 'Prueba WWDR', 0x1234abcd, leaf.publicKey, ca.privateKey, false);
  const keyPem = password
    ? (leaf.privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: password }) as string)
    : (leaf.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string);
  return { certPem, keyPem, wwdrPem, keyPassword: password };
}
