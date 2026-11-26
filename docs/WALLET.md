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

### Falta (en orden)
Hecho el 2026-11-25: Google aprobó el acceso de publicación; la ficha del cliente guarda `wallet = 'google'` al tocar
el botón; botón oficial de Google en español (`public/wallet/agregar-a-google-wallet.svg`, es-419, sin modificar);
logo de respaldo de 660×660 (`public/wallet/logo-660.png`); revisión de seguridad del flujo de guardado.

1. **Activar en Production:** `GOOGLE_WALLET_PUBLIC=on` en Vercel (Production) y volver a desplegar.
2. **Probar todo en Android:** guardar el pase, sumar un sello desde Caja y ver que el pase se actualiza solo; canjear
   y ver que vuelve a empezar.
3. **Tarjetas según el plan:** portada propia y cupones (Standard/Pro), avisos de campañas y niveles (Pro).
4. **Cercanía:** latitud y longitud por sucursal (migración + selector de mapa en Ajustes) y pasarlas al pase.
5. **Apple Wallet:** `.pkpass` firmado y servicio web con APNs (esperando aprobación de Apple Developer).

Nota: las clases ya creadas en Google conservan el logo con el que se crearon (solo se actualiza el pase del cliente).

### Notas
- En `localhost` el guardado falla (Google descarga el logo y necesita una URL pública): probar en Preview de Vercel.
- Preview usa la misma base de Supabase que producción: lo que se haga en pruebas queda guardado.
- Nunca pegar la clave JSON en un chat ni subirla al repo. Para cargarla: `base64 -w0 archivo.json | clip` (Git Bash)
  y pegar en Vercel como Sensitive.

## Lo que necesitas crear

### Apple (cuenta Apple Developer, US$99 al año)
1. Inscribirte en el Apple Developer Program (como organización si tienes RUC; tarda unos días por la verificación).
2. Certificates, Identifiers & Profiles → Identifiers → **Pass Type IDs** → crear, por ejemplo `pass.app.stampaecu`.
3. En ese Pass Type ID → **Create Certificate**: subir un CSR y descargar el certificado `.cer`.
4. Exportarlo como `.p12` con contraseña (Acceso a Llaveros en Mac, u openssl en Windows: te guío).
5. Descargar el certificado intermedio **Apple WWDR G4**.
6. Anotar tu **Team ID** (arriba a la derecha en developer.apple.com).

Variables (Vercel, Sensitive): `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_P12_BASE64`,
`APPLE_PASS_CERT_PASSWORD`, `APPLE_WWDR_PEM_BASE64`, `APPLE_PASS_AUTH_SECRET`.

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
