#!/usr/bin/env bash
# Revisión manual de la firma del .pkpass con OpenSSL (Git Bash en Windows sirve). No toca nada del proyecto.
#   bash scripts/apple-pkpass-check.sh
# 1) Crea una CA de prueba (hace de WWDR) y un certificado de pase firmado por ella, en una carpeta temporal.
# 2) Arma un .pkpass con src/lib/wallet/apple/pkpass.ts.
# 3) Revisa el zip (unzip -t), los SHA-1 del manifest y la firma (openssl cms -verify, con y sin la cadena).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
export MSYS_NO_PATHCONV=1   # Git Bash: que no convierta "/CN=..." en una ruta de Windows

openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out wwdr.pem -days 2 -subj "/C=EC/CN=Prueba WWDR" 2>/dev/null
openssl req -newkey rsa:2048 -keyout pass.key -passout pass:clave123 -out pass.csr -subj "/C=EC/CN=Pass Type ID: pass.app.stampa.prueba" 2>/dev/null
openssl x509 -req -in pass.csr -CA wwdr.pem -CAkey ca.key -CAcreateserial -out pass.pem -days 2 2>/dev/null

W() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }   # rutas que entienda Node en Windows
(cd "$ROOT" && npx tsx scripts/apple-pkpass-sample.ts "$(W "$TMP/pass.pem")" "$(W "$TMP/pass.key")" "$(W "$TMP/wwdr.pem")" "$(W "$TMP/prueba.pkpass")" clave123)

echo "== unzip -t"; unzip -t prueba.pkpass
mkdir x && (cd x && unzip -q ../prueba.pkpass)
echo "== manifest (SHA-1)"
for f in $(cd x && ls | grep -v -e '^manifest.json$' -e '^signature$'); do
  want=$(sed -E "s/.*\"$f\":\"([0-9a-f]{40})\".*/\1/" x/manifest.json)
  got=$(openssl sha1 -r "x/$f" | cut -d' ' -f1)
  [ "$want" = "$got" ] && echo "ok $f" || { echo "MAL $f"; exit 1; }
done
echo "== firma (sin revisar la cadena)"
openssl cms -verify -binary -inform DER -in x/signature -content x/manifest.json -noverify -out verificado.txt
echo "== firma (con la CA de prueba como raíz)"
openssl cms -verify -binary -inform DER -in x/signature -content x/manifest.json -CAfile wwdr.pem -purpose any -out verificado.txt
echo "== estructura"
openssl cms -cmsout -print -inform DER -in x/signature | grep -E "signingTime|messageDigest|sha256|rsaEncryption|CN=" | sed 's/^ *//' | sort -u
