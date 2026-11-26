# Wallet (Apple y Google)

Objetivo: cuando el cliente se registra o abre su tarjeta, puede guardarla en Apple Wallet (iPhone) o Google Wallet
(Android). El pase muestra sus sellos y se actualiza solo cada vez que suma uno.

## Estado (actualizado 2026-11-24)

### Hecho
- Modelo del pase (`src/lib/wallet/pass-model.ts`): progreso, próximo premio, premio listo, colores, QR a la tarjeta y
  hasta 10 sucursales para avisos de cercanía. `applePassJson` y `googleLoyaltyObject` arman cada plataforma.
- **Google Wallet (código listo):**
  - `src/lib/wallet/google.ts`: firma el enlace "Guardar en Google Wallet" (JWT RS256 con `node:crypto`, sin
    dependencias). Clase por negocio `<issuer>.stampa_<businessId>`, objeto por cliente `<issuer>.<customerId>`.
  - `GET /u/<negocio>/wallet/google`: solo para el cliente con sesión y tarjeta en ese negocio; actualiza su pase y lo
    redirige a Google.
  - `src/lib/wallet/sync.ts` (`syncWalletPass`): PATCH del pase al sumar un sello (página del cliente y Caja) y al
    canjear (Caja y ficha del cliente). Si falla Google, el sello se suma igual.
  - Botón negro "Agregar a Google Wallet" debajo de la tarjeta en `/u/<negocio>`, solo si hay variables.
  - Pruebas en `google.test.ts`.
- **Cuentas de Google:** consola de Wallet creada (Issuer ID `3388000000023233833`), proyecto de Cloud con Google
  Wallet API, cuenta de servicio con clave JSON e invitada a la consola.
- **Vercel (2026-11-24):** `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON_BASE64` y `GOOGLE_WALLET_PUBLIC=on` en
  **Production**. Todo el producto está en pruebas y se prueba solo en stampaecu.app (nada de enlaces *.vercel.app),
  así que el botón se ve en producción; mientras Google no apruebe la publicación, solo pueden guardar el pase los
  Gmail autorizados en la consola (al resto le sale "solo para pruebas").
- **Probado en Android (Preview):** Google acepta el enlace firmado y reconoce el pase. Respondió "este pase solo se
  usa para realizar pruebas", que es la restricción del modo demo, no un fallo del código.

### Dónde quedamos (2026-11-25)
**Hecho hoy** (commit `47cf79c`, ya en stampaecu.app):
- Google aprobó el acceso de publicación de Wallet (ya no debería salir "[TEST ONLY]").
- Botón oficial "Agregar a Google Wallet" en español (`public/wallet/agregar-a-google-wallet.svg`, archivo es-419 del
  zip oficial de Google, sin modificar: Google prohíbe botones propios). Mínimo 48 px de alto y 8 px libres alrededor.
- Logo de respaldo cuadrado de 660×660 (`public/wallet/logo-660.png`) cuando el negocio no subió logo.
- La ficha del cliente guarda `customers.wallet = 'google'` al tocar el botón (`repo.setCustomerWallet`, en memory y
  supabase). Se marca al tocar porque Google no avisa si al final lo guardó.
- Revisión de seguridad del flujo de guardado: sin hallazgos (el QR solo lleva a la página pública de la tarjeta).
- `GOOGLE_WALLET_PUBLIC` ya existe en Vercel Production (Sensitive, su valor no se ve). Si el botón no aparece en
  producción, revisar que valga `on` y volver a desplegar.

### Falta (en orden)
1. **Probar todo en Android:** guardar el pase (confirmar que ya no dice "[TEST ONLY]"), sumar un sello desde Caja y
   ver que el pase se actualiza solo; canjear y ver que vuelve a empezar; revisar en Panel → Clientes que diga
   "Tarjeta en el celular: Google Wallet".
2. **Tarjetas según el plan** (propuesta aceptada; usar `src/lib/plans.ts` como fuente de lo que incluye cada plan):

   | Plan | En Wallet |
   |---|---|
   | Básico | Tarjeta de sellos con logo y color (lo que ya existe). |
   | Standard | + imagen de portada propia (`heroImage` de la clase), + cupones/ofertas (Google `offerClass`/`offerObject`) hasta `pushCampaigns` (2/mes), + aviso por cercanía (`proximity`). |
   | Pro | + 8 campañas/mes como mensajes al pase (`addMessage` con notificación), + niveles de cliente (Plata/Oro según visitas). |

   Orden sugerido: portada → cupones → mensajes/campañas → niveles.
3. **Gift cards** (`giftCards` en Standard/Pro): al final, porque manejan saldo en dinero (cobro, cuadre y fraude).
4. **Cercanía:** latitud y longitud por sucursal (migración + selector de mapa en Ajustes) y pasarlas al pase.
5. **Apple Wallet:** código listo (`.pkpass` firmado, servicio web y APNs; oculto sin variables). Esperando que Apple
   apruebe la cuenta de Apple Developer (enviada el 2026-11-25). Tras la aprobación: seguir "Apple ... paso a paso sin
   Mac" más abajo.

Nota: las clases ya creadas en Google conservan el logo con el que se crearon (solo se actualiza el pase del cliente).

### Otros pendientes (fuera de Wallet)
- **Panel de administrador:** desplegado (commit `e2468c1`, migración 0009 aplicada). En producción hay 12 negocios
  inventados (`demo_biz_*`, slugs `demo-*`) para ver cómo se ve; se borran con `supabase/demo/admin_demo_clean.sql`.
- Cambiar la contraseña temporal del administrador en /admin → Mi cuenta.
- Confirmar los precios supuestos de DeepSeek en `AI_PRICES` (`src/lib/domain/admin-insights.ts`).

### Notas
- En `localhost` el guardado falla (Google descarga el logo y necesita una URL pública): probar en Preview de Vercel.
- Preview usa la misma base de Supabase que producción: lo que se haga en pruebas queda guardado.
- Nunca pegar la clave JSON en un chat ni subirla al repo. Para cargarla: `base64 -w0 archivo.json | clip` (Git Bash)
  y pegar en Vercel como Sensitive.

## Lo que necesitas crear

### Apple (cuenta Apple Developer, US$99 al año) — paso a paso sin Mac

El código de Apple Wallet ya está listo (ver "Apple Wallet: cómo funciona" más abajo). Mientras falten las variables,
**todo lo de Apple queda oculto** (botón, descargas y servicio web responden como si no existieran). Cuando Apple
apruebe la cuenta, sigue estos pasos en orden. Todo se hace en **Git Bash** (viene con Git para Windows). Copia y pega
cada comando tal cual; donde dice `TU-CORREO` pon tu correo.

**Paso 1. Crear el Pass Type ID**
1. Entra a developer.apple.com → **Account** → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Botón **+** → elige **Pass Type IDs** → Continue.
3. Description: `Stampa tarjetas`. Identifier: `pass.app.stampaecu.tarjetas` → Continue → Register.
4. Anota ese identificador: es `APPLE_PASS_TYPE_ID`.

**Paso 2. Anotar el Team ID**
- developer.apple.com → **Account** → **Membership details** → **Team ID** (10 letras y números, ej. `AB12CD34EF`).
  Es `APPLE_TEAM_ID`.

**Paso 3. Crear la clave y la solicitud (CSR) en tu computadora**
Abre Git Bash y pega, una línea a la vez:
```bash
mkdir -p ~/apple-wallet && cd ~/apple-wallet
openssl genrsa -out pase.key 2048
MSYS_NO_PATHCONV=1 openssl req -new -key pase.key -out pase.csr -subj "/emailAddress=TU-CORREO/CN=Stampa/C=EC"
```
Quedan dos archivos en la carpeta `apple-wallet` de tu usuario: `pase.key` (tu clave privada: **nunca** la compartas
ni la subas al repo) y `pase.csr` (la solicitud que se sube a Apple).

**Paso 4. Pedir el certificado a Apple**
1. Identifiers → abre `pass.app.stampaecu.tarjetas` → **Create Certificate**.
2. Sube `pase.csr` (está en `C:\Users\<tu usuario>\apple-wallet`) → Continue → **Download**. Baja un archivo
   `pass.cer`. Muévelo a la carpeta `apple-wallet`.

**Paso 5. Convertir el certificado a PEM**
```bash
cd ~/apple-wallet
openssl x509 -inform DER -in pass.cer -out pase.pem
openssl x509 -in pase.pem -noout -subject -enddate
```
Debe mostrar `UID = pass.app.stampaecu.tarjetas` y la fecha de vencimiento (dura 1 año: anótala para renovarlo).
Revisa que el certificado y la clave son pareja (las dos líneas deben salir iguales):
```bash
openssl x509 -noout -modulus -in pase.pem | openssl sha256
openssl rsa -noout -modulus -in pase.key | openssl sha256
```

**Paso 6. Bajar el certificado intermedio de Apple (WWDR G4)**
```bash
curl -sSLo AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
openssl x509 -in wwdr.pem -noout -subject
```
Debe decir `... Apple Worldwide Developer Relations ... OU = G4`.

**Paso 7. Cargar las variables en Vercel** (Project → Settings → Environment Variables; marca **Sensitive** y
**Production**). Crea estas seis, una por una:

1. `APPLE_PASS_TYPE_ID` = `pass.app.stampaecu.tarjetas` (paso 1).
2. `APPLE_TEAM_ID` = tu Team ID (paso 2).
3. `APPLE_PASS_CERT_PEM_BASE64`, `APPLE_PASS_KEY_PEM_BASE64` y `APPLE_WWDR_PEM_BASE64`: cada comando copia el texto al
   portapapeles; pégalo en Vercel en la variable que indica el comentario y recién entonces corre el siguiente:
   ```bash
   base64 -w0 ~/apple-wallet/pase.pem | clip    # → APPLE_PASS_CERT_PEM_BASE64
   base64 -w0 ~/apple-wallet/pase.key | clip    # → APPLE_PASS_KEY_PEM_BASE64
   base64 -w0 ~/apple-wallet/wwdr.pem | clip    # → APPLE_WWDR_PEM_BASE64
   ```
4. `APPLE_PASS_AUTH_SECRET`: un secreto nuevo de 64 caracteres:
   ```bash
   openssl rand -hex 32 | clip                  # → APPLE_PASS_AUTH_SECRET
   ```

`APPLE_PASS_KEY_PASSWORD` no hace falta (la clave del paso 3 no tiene contraseña). Si algún día usas una clave con
contraseña, ponla ahí.

Importante: el `APPLE_PASS_AUTH_SECRET` **no se cambia** después: los pases ya instalados llevan un token hecho con él
y dejarían de actualizarse.

**Paso 8. Volver a desplegar**
- Vercel → Deployments → el último de Production → **Redeploy**. Si alguna variable quedó mal pegada, el registro de
  Vercel dice `Apple Wallet desactivado: revisa APPLE_...` (solo el nombre, nunca el valor) y el botón no aparece.

**Paso 9. Probar en el iPhone**
1. En el iPhone, con **Safari**, abre `https://stampaecu.app/u/<tu-negocio>` e inicia sesión como cliente.
2. Toca **Agregar a Apple Wallet** → **Agregar**. La tarjeta queda en Wallet y en Panel → Clientes dice "Apple Wallet".
3. Desde Caja suma un sello a ese cliente: en segundos el pase cambia solo y sale el aviso en la pantalla bloqueada.
4. Si no se actualiza: abre el pase → **…** → **Detalles del pase** → desliza hacia abajo para refrescar. Los errores
   que reporta el iPhone aparecen en los registros de Vercel como `Apple Wallet (iPhone): …`.

**Paso 10. Guardar los archivos**
- Guarda la carpeta `apple-wallet` en un lugar seguro (por ejemplo un USB o tu gestor de contraseñas) y bórrala de la
  computadora. Nunca la subas a GitHub ni la pegues en un chat. Para renovar el certificado en un año se repiten los
  pasos 4, 5 y 7 (con el mismo `pase.csr`) y se vuelve a desplegar.

**Insignia oficial "Agregar a Apple Wallet"** (pendiente): Apple solo la entrega aceptando sus condiciones en
developer.apple.com/wallet/add-to-apple-wallet-guidelines → **Download badge files**. Descomprime el zip, entra a la
carpeta en español de Latinoamérica (o México) y copia el archivo SVG **sin modificarlo** a
`public/wallet/agregar-a-apple-wallet.svg`. Después cambia `APPLE_BADGE_AVAILABLE` a `true` en
`src/components/customer/AppleWalletBadge.tsx`. Mientras esté en `false`, la página del cliente usa un botón de texto.

### Apple Wallet: cómo funciona (código)

- **Archivos:** `src/lib/wallet/apple/` → `config.ts` (variables), `auth.ts` (serial y token), `passes.ts` (pass.json
  de los tres estilos), `pkpass.ts` (manifest SHA-1, firma PKCS#7/CMS separada hecha a mano con `node:crypto` y zip con
  `node:zlib`), `asn1.ts` (DER mínimo), `apns.ts` (push HTTP/2), `service.ts` (arma el pase desde la base),
  `webservice.ts` (servicio web), `index.ts` (lo que usan sync.ts y notify.ts), `images.ts` (imágenes incrustadas),
  `testing.ts` (certificados desechables, solo para pruebas).
- **Descargas** (cliente con sesión, solo lo suyo; devuelven `application/vnd.apple.pkpass`):
  `/u/<negocio>/wallet/apple` (sellos; marca `customers.wallet = 'apple'`), `/u/<negocio>/wallet/apple/cupon/<cof_…>`
  (solo cupones vigentes y sin usar), `/u/<negocio>/wallet/apple/gift/<gft_…>` (solo gift cards activas).
- **Servicio web** (`webServiceURL = https://stampaecu.app/api/wallet`): registrar/borrar dispositivo, lista de pases
  cambiados (204 si no hay), pase más reciente (304 si no cambió) y log. Token `ApplePass <HMAC del serial>` comparado en
  tiempo constante; otro Pass Type ID → 404.
- **Serial** = `<tipo>.<negocio>.<id>`: `s.biz_….cli_…` (sellos), `c.biz_….cof_…` (cupón), `g.biz_….gft_…` (gift
  card). Lleva el negocio porque el repo siempre busca por negocio y el iPhone solo manda el serial.
- **Imágenes:** icon y logo de Stampa (1x/2x/3x) generados con `scripts/apple-wallet-images.ps1` a partir del dibujo de
  `public/favicon.svg`. Quedan en `public/wallet/apple/` y **en base64 dentro de `images.ts`**, así la función de
  Vercel no lee archivos del disco (sin riesgo de que el trazado de archivos de Next las deje fuera). Mejora futura:
  usar el logo propio del negocio (bajarlo, redimensionarlo y cachearlo).
- **Actualizar:** `syncApplePasses(card)` marca los seriales del cliente (`appleMarkUpdated`) y manda un push vacío por
  APNs a cada dispositivo; el iPhone pide los pases nuevos. **Quien cambia algo solo llama a `src/lib/wallet/sync.ts`**
  (`syncCustomerWallet`, `syncCustomerOfferWallet`, `syncGiftCardWallet`): ahí se actualizan Google y Apple, incluido el
  cupón recién usado (que ya no viene en la tarjeta) y las gift cards sin cliente, con un solo push por dispositivo.
- **Log del iPhone** (`POST /api/wallet/v1/log`): solo se escribe en los registros con `APPLE_WALLET_DEBUG=on` (limpio y
  recortado); sin esa variable responde 200 y no guarda nada. Máximo 10 dispositivos por pase (se borra el más antiguo).
- **APNs 410** (o token inválido): se borra el dispositivo y sus registros (`repo.appleUnregisterToken`); si el pase
  sigue instalado, iOS lo vuelve a registrar.
- **Avisos en la pantalla bloqueada:** iOS solo muestra el `changeMessage` de un campo que cambió. Cambian: el titular
  de sellos (`%@`), el saldo (`Tu saldo ahora es %@`) y el campo CUPÓN de la tarjeta de sellos (`Nuevo cupón: %@`, solo
  durante 24 h desde que llegó el cupón, para que usar otro cupón no avise "nuevo"). `notifyApple` devuelve true solo
  para "Nuevo cupón: <título>"; para avisos de texto libre falta guardar el último aviso en la base (pendiente del repo).
- **Last-Modified:** se deriva del contenido del pase (hash del manifest), así el 304 nunca oculta un cambio y no hace
  falta guardar versiones.
- **Revisar la firma con OpenSSL** (sin iPhone): `bash scripts/apple-pkpass-check.sh` (crea certificados de prueba,
  arma un .pkpass y corre `unzip -t` y `openssl cms -verify`). Las pruebas de Vitest también verifican la firma.

### Google (gratis)
1. pay.google.com/business/console → crear cuenta de emisor de **Google Wallet API** → anotar el **Issuer ID**.
2. Google Cloud Console → crear proyecto → habilitar **Google Wallet API**.
3. Crear una **cuenta de servicio** → clave JSON → en la consola de Wallet, dar acceso a esa cuenta de servicio.
4. Pedir acceso de publicación (al inicio solo funciona en modo demo para cuentas de prueba).

Variables (Vercel, Sensitive): `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON_BASE64`.

## Diseño técnico previsto

- `GET /u/<negocio>/wallet/apple` → genera y firma el `.pkpass` del cliente con sesión (cookie `stampa_cliente`).
- Servicio web de Apple (`/api/wallet/v1/...`): registro de dispositivos, lista de pases actualizados y entrega del
  pase nuevo; al sumar un sello se envía un push vacío por APNs para que el iPhone pida la versión nueva.
- `GET /u/<negocio>/wallet/google` → enlace "Guardar en Google Wallet" (JWT firmado con la cuenta de servicio);
  al sumar un sello se actualiza el objeto con la API (PATCH).
- Tabla nueva `wallet_passes` (cliente, plataforma, dispositivo, token de push, última versión).
- Sucursales: agregar latitud y longitud (migración) y un selector de mapa en Ajustes para la cercanía.
