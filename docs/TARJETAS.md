# Tarjetas extra en Wallet: Cupones (Offers) y Gift Cards, cercanía y Apple Wallet

Plan de trabajo acordado el 2026-11-26. Es el contrato común entre las partes: nombres, rutas y reglas de este archivo
no se cambian sin actualizarlo aquí.

## Reparto por plan (precios sin cambios)

| Plan | Tarjetas | Otras |
|---|---|---|
| Básico ($29,99) | Sellos (loyalty) | — |
| Standard ($54,99) | Sellos + **Cupones** | Cercanía, 2 campañas/mes |
| Pro ($79,99) | Sellos + Cupones + **Gift Cards** | Cercanía, 8 campañas/mes |

`src/lib/plans.ts`: `giftCards` pasa a `false` en Standard (solo Pro). Nuevo flag `offers: boolean` (Standard y Pro).
`pushCampaigns` = cupones que se pueden **enviar con notificación** por mes (2 / 8). Crear cupones sin enviarlos no
cuenta.

## Hechos verificados de las plataformas (2026-11-26)

- **Google:** ubicaciones en `merchantLocations` (máx. 10 por clase y 10 por objeto; el campo `locations` está obsoleto y
  NO dispara avisos). Radio y permanencia los decide Google; el texto del aviso cercano también.
  Notificaciones: `addMessage` con `messageType: 'TEXT_AND_NOTIFY'` o PATCH con `notifyPreference: 'NOTIFY'`
  (campos permitidos en loyalty: `loyaltyPoints.balance`, `secondaryLoyaltyPoints.balance`). **Máximo 3 notificaciones
  cada 24 h** (la cuarta da `QuotaExceededException`: entonces usar `TEXT`). Las ofertas avisan solas antes de vencer
  (`disableExpirationNotification` para apagarlo). `linkedOfferIds` en el loyaltyObject asocia ofertas a la tarjeta
  de sellos (el objeto oferta debe existir antes).
- **Apple:** estilos `storeCard` (sellos y gift cards; la gift card muestra el saldo) y `coupon` (cupones). `locations`
  máx. 10, radio corto (~100 m), `maxDistance` solo lo achica; `relevantText` por ubicación sin el nombre del negocio.
  Es una sugerencia silenciosa en la pantalla bloqueada. Avisos de cambio: campo con `changeMessage` (ej.
  `"Nuevo cupón: %@"`) + push APNs vacío → el iPhone pide el pase nuevo al servicio web.

## Datos (migración `supabase/migrations/0010_wallet_cards.sql`)

- `locations`: `latitude double precision`, `longitude double precision` (nulos; ambos o ninguno; rangos válidos).
- `offers` (cupón creado por el dueño): id `gen_id('ofr')`, business_id, title (≤ 40), description (≤ 200),
  terms (≤ 300, opcional), image_url (https, opcional), starts_at, ends_at, status `draft|sent|ended`, sent_at,
  created_by (staff), created_at.
- `customer_offers` (el cupón de un cliente): id `gen_id('cof')`, offer_id, business_id, customer_id, created_at,
  redeemed_at, redeemed_by (staff), redeemed_location_id. Único (offer_id, customer_id). Un cupón se usa una vez.
- `gift_cards`: id `gen_id('gft')`, business_id, customer_id (nullable: se puede vender sin cliente registrado),
  code (12 caracteres, único global, sin ambiguos), balance_cents int ≥ 0, initial_cents, status `active|void`,
  created_at, created_by. Saldo máximo US$500 (50000).
- `gift_card_movements`: id, gift_card_id, business_id, kind `issue|topup|charge|void|adjust`, amount_cents (con signo),
  balance_after_cents, staff_id, location_id, note, created_at. **El saldo solo cambia por una función SQL atómica**
  (`gift_card_apply(...)` con `for update`) que inserta el movimiento y rechaza saldo negativo.
- `wallet_notifications`: business_id, customer_id, platform `google|apple`, kind, created_at — para respetar el tope de
  3 avisos/24 h por cliente y contar campañas del mes.
- `apple_devices` / `apple_registrations`: device_library_id, push_token, pass_type_id, serial, updated_at (servicio
  web de Apple).
- Todas con RLS activado y sin acceso para `anon`/`authenticated` (igual que 0009). La app usa service role.

## Contrato del repo (`src/lib/repo/index.ts`)

Tipos en `src/lib/contracts.ts`: `Offer`, `OfferStatus`, `CustomerOffer`, `GiftCard`, `GiftCardMovement`,
`GiftCardMovementKind`, `AppleRegistration`; `Location` gana `latitude?`, `longitude?`; `CustomerCard` gana
`locations: Location[]` (solo activas con coordenadas, máx. 10), `offers: CustomerOffer & { offer: Offer }[]`
(vigentes y sin usar) y `giftCards: GiftCard[]`.

Métodos (memory y supabase): `setLocationCoords`, `listOffers`, `getOffer`, `createOffer`, `updateOffer`,
`sendOffer` (crea `customer_offers` para todos los clientes del negocio y marca `sent`; devuelve los ids),
`endOffer`, `offerStats`, `findCustomerOffer(businessId, id)`, `redeemCustomerOffer`, `listGiftCards`,
`getGiftCard`, `findGiftCardByCode`, `issueGiftCard`, `topupGiftCard`, `chargeGiftCard`, `voidGiftCard`,
`listGiftCardMovements`, `countWalletNotifications(businessId, customerId, sinceIso)`, `logWalletNotification`,
`countCampaignsThisMonth(businessId, now)`, y los del servicio web de Apple (`appleRegister`, `appleUnregister`,
`appleSerialsForDevice`, `applePushTokensForSerial`).

Reglas puras y probadas en `src/lib/domain/wallet-cards.ts` (+ `.test.ts`): validar cupón, vigencia, generar/validar
código de gift card, parsear montos (reusar `parseAmountCents` de `admin-insights.ts`), tope de notificaciones,
campañas restantes del mes según plan.

## Permisos y plan

- Cupones: crear/enviar dueño y gerente; canjear en Caja cualquier miembro del equipo. Solo si `features(plan).offers`.
- Gift Cards: vender/recargar/anular dueño y gerente; cobrar cualquier miembro. Solo si `features(plan).giftCards`.
- Todo canje y movimiento queda en el registro de actividad (audit) existente.
- Si el negocio baja de plan: lo ya emitido sigue funcionando (canje y saldo), pero no se crean ni envían nuevos.

## Rutas fijas

Cliente (con sesión, solo lo suyo):
- `/u/[slug]/wallet/google` (ya existe, sellos) · `/u/[slug]/wallet/google/cupon/[id]` · `/u/[slug]/wallet/google/gift/[id]`
- `/u/[slug]/wallet/apple` · `/u/[slug]/wallet/apple/cupon/[id]` · `/u/[slug]/wallet/apple/gift/[id]` (descargan `.pkpass`)

Servicio web de Apple (`webServiceURL = https://stampaecu.app/api/wallet`):
- `POST/DELETE /api/wallet/v1/devices/[device]/registrations/[passType]/[serial]`
- `GET /api/wallet/v1/devices/[device]/registrations/[passType]?passesUpdatedSince=`
- `GET /api/wallet/v1/passes/[passType]/[serial]` · `POST /api/wallet/v1/log`
- Autenticación `Authorization: ApplePass <token>`; token = HMAC(serial) con `APPLE_PASS_AUTH_SECRET`.

Panel:
- `/panel/cupones` (lista, crear, enviar, estadísticas) · `/panel/gift-cards` (lista, vender, detalle con movimientos)
- Caja: canjear cupón y cobrar/recargar gift card escaneando el QR o escribiendo el código.
- Ajustes → Sucursales: coordenadas por sucursal (botón "Usar mi ubicación actual", pegar enlace de Google Maps, o
  escribir lat/long; vista previa con enlace a Google Maps). Sin librerías de mapas.

## Módulos de Wallet (sin dependencias nuevas; `node:crypto`, `node:http2`, `node:zlib`)

- `src/lib/wallet/google.ts`: sellos (+ `merchantLocations`, `linkedOfferIds`). `google-offer.ts`, `google-giftcard.ts`.
- `src/lib/wallet/apple/`: `pkpass.ts` (zip + manifest SHA-1 + firma PKCS#7 separada hecha a mano con node:crypto),
  `passes.ts` (JSON de los tres estilos), `apns.ts` (HTTP/2 con el certificado del pase), `auth.ts`, `config.ts`.
- `src/lib/wallet/notify.ts`: punto único para avisar a un cliente (Google y Apple) respetando el tope.
- `src/lib/wallet/sync.ts`: tras sello, canje, cupón o movimiento de gift card, actualiza todos los pases del cliente.
- Botones: Google con la imagen oficial (`public/wallet/agregar-a-google-wallet.svg`); Apple con la insignia oficial
  "Agregar a Apple Wallet" en español si se puede obtener de Apple; si no, queda pendiente y se usa texto.

## Variables de Apple (se cargan cuando Apple apruebe la cuenta; sin ellas todo lo de Apple queda oculto)

`APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM_BASE64`, `APPLE_PASS_KEY_PEM_BASE64`,
`APPLE_PASS_KEY_PASSWORD` (opcional), `APPLE_WWDR_PEM_BASE64`, `APPLE_PASS_AUTH_SECRET`.
Se generan con OpenSSL en Git Bash (sin Mac): ver `docs/WALLET.md` → Apple.

## Hecho en Fase 1 (datos y base, 2026-11-26)

Typecheck y `npx vitest run` en verde. La migración `0010_wallet_cards.sql` **no está aplicada**: la aplica el líder.

### Plan (`src/lib/plans.ts`)
- `PlanFeatures.offers` (Básico false, Standard true, Pro true); `giftCards` solo Pro. `planIncludes` suma las líneas
  de cupones, cercanía y gift cards.
- **Datos de ejemplo:** Café La Esquina (`biz_esquina`, login `andrea@esquina.demo`) pasó de Standard a **Pro** para
  que se vea todo (cupones, gift cards, coordenadas). Datos en `src/lib/seed-wallet.ts`.

### Tipos (`src/lib/contracts.ts`)
`OfferStatus`, `Offer`, `CustomerOffer`, `CustomerOfferWithOffer` (= `CustomerOffer & { offer: Offer }`),
`CustomerOfferDetail` (+ `customerName`, lo que ve Caja), `NewOfferInput`, `OfferStats {offerId, sent, redeemed, rate}`,
`GiftCardStatus` (`active|void`), `GiftCard`, `GiftCardMovementKind`, `GiftCardMovement`, `IssueGiftCardInput`,
`GiftCardResult {giftCard, movement}`, `WalletPlatform`, `NewWalletNotification`, `AppleRegistration`.
`Location.latitude?/longitude?`. `CustomerCard` ahora trae SIEMPRE `locations`, `offers` y `giftCards`.

### Repo (`src/lib/repo/index.ts`, memory y supabase)
Reglas comunes: errores en español (lanza `Error`); `staffId` debe estar activo en el negocio; crear/editar/enviar/
terminar cupones y vender/recargar/anular gift cards exigen **dueño o gerente** (el repo lo valida; mensaje
`WALLET_MANAGER_ONLY`); crear/editar/enviar exige `features(plan).offers`, vender/recargar `features(plan).giftCards`;
canjear, cobrar, anular y terminar no miran el plan.

```ts
setLocationCoords(businessId, locationId, coords: { latitude: number; longitude: number } | null, actorId?): Promise<Location>
listOffers(businessId): Promise<Offer[]>                                   // más reciente primero
getOffer(businessId, id): Promise<Offer | null>
createOffer(businessId, input: NewOfferInput, staffId): Promise<Offer>     // queda 'draft'
updateOffer(businessId, id, patch: Partial<NewOfferInput>, staffId): Promise<Offer>   // solo borradores
sendOffer(businessId, id, staffId): Promise<{ offer: Offer; customerIds: string[] }>  // atómico; respeta campañas/mes
endOffer(businessId, id, staffId): Promise<Offer>
offerStats(businessId, offerId?): Promise<Record<string, OfferStats>>     // clave = offerId
findCustomerOffer(businessId, id): Promise<CustomerOfferDetail | null>     // id = cof_... (lo que codifica el QR)
redeemCustomerOffer(businessId, customerOfferId, staffId, locationId?): Promise<CustomerOfferWithOffer>
listGiftCards(businessId, opts?: { customerId?: string; status?: GiftCardStatus }): Promise<GiftCard[]>
getGiftCard(businessId, id): Promise<GiftCard | null>
findGiftCardByCode(businessId, code): Promise<GiftCard | null>             // acepta minúsculas, espacios y guiones
issueGiftCard(businessId, input: IssueGiftCardInput): Promise<GiftCardResult>
topupGiftCard(businessId, giftCardId, amountCents, staffId, opts?: { locationId?: string; note?: string }): Promise<GiftCardResult>
chargeGiftCard(businessId, giftCardId, amountCents, staffId, opts?: { locationId?: string; note?: string }): Promise<GiftCardResult>
voidGiftCard(businessId, giftCardId, staffId, note?): Promise<GiftCardResult>
listGiftCardMovements(businessId, giftCardId, limit = 100): Promise<GiftCardMovement[]>   // más reciente primero
countWalletNotifications(businessId, customerId, sinceIso): Promise<number>
logWalletNotification(n: NewWalletNotification): Promise<void>
countCampaignsThisMonth(businessId, now?: Date): Promise<number>
appleRegister(reg: Omit<AppleRegistration, 'updatedAt'>): Promise<{ created: boolean }>     // created → 201, si no 200
appleUnregister(deviceLibraryId, passTypeId, serial): Promise<void>
appleSerialsForDevice(deviceLibraryId, passTypeId, updatedSinceIso?): Promise<{ serials: string[]; lastUpdated: string | null }>
applePushTokensForSerial(passTypeId, serial): Promise<string[]>
appleMarkUpdated(passTypeId, serial): Promise<void>                        // EXTRA: llamar antes del push APNs
```

- `amountCents` siempre positivo en las firmas; el movimiento guarda el signo (`charge`/`void` negativos).
- `getCustomerCard`/`listCustomerCards`: `locations` = activas con coordenadas (máx. 10); `offers` = enviados, dentro de
  fechas y sin usar (el que vence antes primero); `giftCards` = activas del cliente.
- Campañas del mes = cupones con `sentAt` desde el inicio del mes en Ecuador (no se cuentan en `wallet_notifications`).
- Registro de actividad (`listAudit`): `offer.create`, `offer.update`, `offer.send`, `offer.end`, `offer.redeem`,
  `gift.issue`, `gift.topup`, `gift.charge`, `gift.void`, `location.coords`. **Falta** agregar sus etiquetas en
  `src/components/control/labels.ts` (archivo de interfaz). El código completo de una gift card nunca va al registro
  (solo `•••• •••• XXXX`).
- Supabase: el saldo cambia solo por `gift_card_apply(...)`; la venta por `gift_card_issue(...)` (reintenta si el código
  choca); el envío por `offer_send(...)`; el canje de cupón es un `update ... where redeemed_at is null`.

### Reglas puras (`src/lib/domain/wallet-cards.ts`)
Constantes: `OFFER_TITLE_MAX` 40, `OFFER_DESCRIPTION_MAX` 200, `OFFER_TERMS_MAX` 300, `GIFT_CARD_MAX_CENTS` 50000,
`GIFT_CARD_MIN_CENTS` 100, `GIFT_CARD_ALPHABET`, `WALLET_NOTIFY_MAX` 3, `WALLET_MANAGER_ONLY`.
Funciones: `walletFeatureError(plan, 'offers'|'giftCards')`, `campaignsRemaining(plan, sentThisMonth)`,
`campaignLimitError(plan)`, `campaignMonthStartIso(nowMs)`, `canNotify(n)`, `notifyWindowStartIso(nowMs)`,
`cleanOfferInput`, `validateOffer(input, nowMs) → {field, error} | null`, `offerWindowFromDays('YYYY-MM-DD','YYYY-MM-DD')`
(00:00 a 23:59:59 de Ecuador), `ecStartOfDayIso`, `offerInWindow`, `isOfferLive`, `customerOfferRedeemError`,
`liveCustomerOffers`, `offerStatusLabel` (Borrador/Programado/Vigente/Vencido/Terminado), `generateGiftCardCode`,
`normalizeGiftCardCode`, `isGiftCardCode`, `formatGiftCardCode` (XXXX-XXXX-XXXX), `maskGiftCardCode`,
`parseGiftCardAmount` (usa `parseAmountCents`), `validateGiftCardLoad(amount, balance?)`, `validateGiftCardCharge`,
`cleanGiftCardNote`, `validateCoords`, `parseCoordsInput` (lat,long pegado o enlace largo de Google Maps; los cortos
`maps.app.goo.gl` no traen coordenadas), `googleMapsUrl`, `formatCents` (reexportado).

### Wallet (stubs con firma fija)
- `src/lib/wallet/apple/config.ts`: `appleWalletConfig(env?) → AppleWalletConfig | null` (valida de verdad todas las
  `APPLE_*`; solo registra NOMBRES de variables mal pegadas). `src/lib/wallet/apple/index.ts`:
  `appleWalletEnabled(env?)` (real), `syncApplePasses(card)` (no-op), `notifyApple(card, message)` (false).
- `src/lib/wallet/google.ts`: `notifyGoogle(card, message): Promise<boolean>` (stub, false). `passModelFor` ya usa
  `card.locations` y `googleLoyaltyObject` manda `merchantLocations` (máx. 10) en vez de `locations`.
- `src/lib/wallet/sync.ts`: `syncCustomerWallet(businessId, customerId)` (carga la tarjeta una vez y llama a
  `syncGoogleWallet` + `syncApplePasses`); `syncWalletPass` es alias.
- `src/lib/wallet/notify.ts`: `notifyCustomer(businessId, customerId, message, kind) → { sent, reason? }` (reason:
  `disabled|not_found|no_wallet|cap|unavailable|error`; registra un aviso por plataforma que lo acepta) y
  `notifyOfferSent(businessId, offerId, customerIds) → { notified, skipped }` (por cliente: `syncCustomerWallet` y
  luego aviso "Nuevo cupón: <título>", 5 a la vez). Ninguna lanza.
- Serial sugerido para Apple: id del cliente (sellos), id del `customer_offer` (cupón), id de la gift card.

## Contenido de los códigos QR (Fase 2, fijo)

- Cupón (pase de Google y Apple, y página del cliente): `STAMPA-CUPON:<customerOfferId>` (id `cof_…`).
- Gift card: `STAMPA-GIFT:<code>` (código de 12 caracteres). Debajo del QR se muestra el código legible `XXXX XXXX XXXX`.
- Caja acepta el contenido del QR o el código escrito a mano (`normalizeGiftCardCode`).
- Insignia de Apple: `public/wallet/agregar-a-apple-wallet.svg` + `APPLE_BADGE_AVAILABLE = true` en
  `src/components/customer/AppleWalletBadge.tsx` (mientras sea `false`, botón de texto negro).

## Hecho en Fase 2 — Google (2026-11-26)

Typecheck y `npx vitest run` en verde. Sin dependencias nuevas.

### Para la página del cliente (`src/lib/wallet/google.ts`)
- Mostrar los botones de cupón y gift card solo si `googleOfferSaveVisible()` (misma regla que `googleWalletButtonVisible()`).
- Enlaces: `googleCouponSavePath(slug, customerOfferId)` → `/u/[slug]/wallet/google/cupon/[id]` y
  `googleGiftSavePath(slug, giftCardId)` → `/u/[slug]/wallet/google/gift/[id]` (imagen oficial del botón, igual que sellos).
- Las rutas exigen sesión del cliente y que el cupón/gift card sea SUYO y de ese negocio (cupón vigente y sin usar;
  gift card `active`); si no, vuelven a `/u/[slug]`. Hacen PATCH previo y redirigen al JWT con clase + objeto.

### Para Caja / Panel (`src/lib/wallet/sync.ts`) — llamar después de la operación (nunca lanzan)
- `syncCustomerOfferWallet(businessId, customerOfferId)`: tras **canjear** o terminar un cupón. El cupón usado ya no
  viene en `card.offers`, por eso `syncWalletPass(businessId, customerId)` solo NO alcanza para marcarlo COMPLETED en
  Google. Esta función hace el PATCH del cupón y luego `syncCustomerWallet` del cliente (Google + Apple).
- `syncGiftCardWallet(businessId, giftCardId, { notify? })`: tras **vender, recargar, cobrar o anular** una gift card
  (también sin cliente o anulada). `notify: true` solo en recargas (Google decide si avisa).
- `notifyOfferSent` (sin cambios de firma) ya crea y enlaza los cupones en Google por cliente vía `syncCustomerWallet`.

### Comportamiento de `syncGoogleWallet(card)`
- PATCH de la tarjeta de sellos, de cada cupón de `card.offers` y de cada gift card de `card.giftCards` (4 a la vez;
  404 = no lo guardó, se ignora). Si `customer.wallet === 'apple'` no toca cupones ni gift cards en Google.
- Si `customer.wallet === 'google'`: asegura la `offerClass` (una vez cada 10 min por proceso) y crea el `offerObject`
  (PATCH, si 404 → POST, 409 = ok), y manda `linkedOfferIds` en el PATCH de la tarjeta con los cupones vigentes (la
  lista se reemplaza: los usados/vencidos se desenlazan solos).
- `notifyGoogle(card, message)`: `addMessage` TEXT_AND_NOTIFY (encabezado = negocio, id único); 429/Quota → reintenta
  como TEXT y devuelve false; 404 → false.

### Módulos y exportados
- `google.ts`: además de lo anterior, `googleBrand(business, program, locations)`, `brandFromCard(card)`,
  `googleSaveJwtUrl(config, payload)`, `walletRequest`, `upsertResource`, `ensureClass`, `mapLimit`, `safeId`.
- `google-offer.ts`: `offerClassFor`, `googleOfferObject`, `offerObjectState` (canjeado → COMPLETED; terminado o
  vencido → EXPIRED), `googleOfferSaveUrl`, `syncGoogleOfferObject`, `couponQrValue`, ids: clase
  `<issuer>.stampa_<biz>_<offerId>`, objeto `<issuer>.<cof_id>`.
- `google-giftcard.ts`: `giftCardClassFor`, `googleGiftCardObject` (saldo `{ micros: "<cents*10000>", currencyCode:
  'USD' }`, `cardNumber` XXXX-XXXX-XXXX, anulada → INACTIVE con saldo 0), `googleGiftCardSaveUrl`,
  `syncGoogleGiftCardObject`, `centsToMoney`, `giftQrValue`; ids: clase `<issuer>.stampa_<biz>_gift`, objeto `<issuer>.<gft_id>`.
- Supuestos no verificables sin cuenta real: `linkedOfferIds` por PATCH (en vez de `modifyLinkedOfferObjects`) para que
  sea idempotente; Google acepta `micros` como texto (int64 en JSON); el tope de avisos llega como 429 o con "quota"
  en el cuerpo. Probar en Android con el negocio de ejemplo (Pro) antes de anunciarlo.
