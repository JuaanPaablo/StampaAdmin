# Wallet (Apple y Google)

Objetivo: cuando el cliente se registra o abre su tarjeta, puede guardarla en Apple Wallet (iPhone) o Google Wallet
(Android). El pase muestra sus sellos y se actualiza solo cada vez que suma uno.

## Estado

- Hecho: modelo del pase (`src/lib/wallet/pass-model.ts`) con progreso, próximo premio, premio listo, colores,
  QR a la tarjeta y hasta 10 sucursales para avisos de cercanía. `applePassJson` y `googleLoyaltyObject` arman el
  contenido de cada plataforma. Pruebas en `pass-model.test.ts`.
- Falta (necesita las cuentas): firmar el `.pkpass`, el servicio web de Apple para actualizar pases (APNs),
  la API de Google Wallet, los botones "Agregar a Wallet" en `/u/<negocio>` y coordenadas de cada sucursal.

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
