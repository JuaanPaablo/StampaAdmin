import type { Business, Customer, Location, Program } from '../contracts';

/**
 * Modelo del pase de Wallet (Apple y Google) a partir de la tarjeta del cliente. Es puro: no firma ni envía nada.
 * La firma (.pkpass con certificado de Apple) y la API de Google Wallet se conectan cuando existan las cuentas;
 * ver docs/WALLET.md.
 */

export interface PassLocation { latitude: number; longitude: number; relevantText: string }

export interface PassModel {
  serial: string;                 // id estable del pase = id del cliente
  businessName: string;
  programName: string;
  colors: { bg: string; fg: string; label: string };
  logoText: string;
  logoUrl?: string;
  stamps: number;
  required: number;
  /** "3 de 10" */
  progressText: string;
  /** Próximo premio y cuántos sellos faltan. */
  nextReward: { title: string; missing: number } | null;
  /** Premio listo para canjear (intermedio o final). */
  readyReward: string | null;
  customerName: string;
  cardUrl: string;
  /** Hasta 10 sucursales con coordenadas: Apple `locations` (pantalla bloqueada) y Google `merchantLocations`. */
  locations: PassLocation[];
  terms?: string;
  updatedAt: string;
}

const hex = (v: string | undefined, fallback: string) => (/^#[0-9a-f]{6}$/i.test(v ?? '') ? v! : fallback);

function rgb(h: string): string {
  const n = parseInt(h.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

export function buildPassModel(
  business: Pick<Business, 'name'>,
  program: Pick<Program, 'name' | 'stampsRequired' | 'rewardTitle' | 'colors' | 'logoText' | 'logoUrl' | 'milestones' | 'terms'>,
  customer: Pick<Customer, 'id' | 'name' | 'stamps'>,
  cardUrl: string,
  locations: (Pick<Location, 'name'> & { latitude?: number; longitude?: number })[] = [],
  now: Date = new Date()
): PassModel {
  const required = program.stampsRequired;
  const stamps = Math.max(0, Math.min(customer.stamps, required));
  const milestones = [...(program.milestones ?? [])].filter((m) => m.at < required).sort((a, b) => a.at - b.at);
  const steps = [...milestones, { at: required, title: program.rewardTitle }];
  const next = steps.find((m) => m.at > stamps) ?? null;
  const ready = stamps >= required ? program.rewardTitle : milestones.find((m) => m.at === stamps)?.title ?? null;

  return {
    serial: customer.id,
    businessName: business.name,
    programName: program.name || 'Tarjeta de sellos',
    colors: { bg: hex(program.colors?.bg, '#001D3D'), fg: hex(program.colors?.ink, '#FFFFFF'), label: hex(program.colors?.accent, '#FFC301') },
    logoText: program.logoText,
    logoUrl: program.logoUrl,
    stamps,
    required,
    progressText: `${stamps} de ${required}`,
    nextReward: next ? { title: next.title, missing: next.at - stamps } : null,
    readyReward: ready,
    customerName: customer.name,
    cardUrl,
    locations: locations
      .filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))
      .slice(0, 10)
      .map((l) => ({ latitude: l.latitude!, longitude: l.longitude!, relevantText: `Estás cerca de ${business.name}. ¡Suma tu sello!` })),
    terms: program.terms,
    updatedAt: now.toISOString()
  };
}

/** Texto del campo principal: lo que el cliente ve de un vistazo. */
export function headline(m: PassModel): string {
  if (m.readyReward) return `¡Premio listo: ${m.readyReward}!`;
  if (m.nextReward) return `Te ${m.nextReward.missing === 1 ? 'falta 1 sello' : `faltan ${m.nextReward.missing} sellos`} para ${m.nextReward.title}`;
  return m.progressText;
}

/**
 * pass.json de Apple Wallet (tipo storeCard). Falta firmarlo junto a las imágenes (icon.png, logo.png, strip.png)
 * con el certificado del Pass Type ID para obtener el .pkpass.
 */
export function applePassJson(m: PassModel, ids: { passTypeIdentifier: string; teamIdentifier: string; webServiceURL?: string; authenticationToken?: string }) {
  return {
    formatVersion: 1,
    passTypeIdentifier: ids.passTypeIdentifier,
    teamIdentifier: ids.teamIdentifier,
    serialNumber: m.serial,
    organizationName: m.businessName,
    description: `${m.programName} de ${m.businessName}`,
    logoText: m.businessName,
    backgroundColor: rgb(m.colors.bg),
    foregroundColor: rgb(m.colors.fg),
    labelColor: rgb(m.colors.label),
    ...(ids.webServiceURL && ids.authenticationToken ? { webServiceURL: ids.webServiceURL, authenticationToken: ids.authenticationToken } : {}),
    ...(m.locations.length ? { locations: m.locations } : {}),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: m.cardUrl, messageEncoding: 'iso-8859-1', altText: m.customerName }],
    storeCard: {
      headerFields: [{ key: 'progress', label: 'SELLOS', value: m.progressText }],
      primaryFields: [{ key: 'headline', label: m.programName.toUpperCase(), value: headline(m), changeMessage: '%@' }],
      secondaryFields: [{ key: 'customer', label: 'CLIENTE', value: m.customerName }],
      backFields: [
        { key: 'card', label: 'Tu tarjeta', value: m.cardUrl, attributedValue: `<a href="${m.cardUrl}">Abrir mi tarjeta</a>` },
        ...(m.terms ? [{ key: 'terms', label: 'Condiciones', value: m.terms }] : []),
        { key: 'stampa', label: 'Stampa', value: 'Tarjeta de sellos digital de Stampa.' }
      ]
    }
  };
}

/**
 * Objeto de fidelidad de Google Wallet (loyaltyObject). La clase (loyaltyClass) es una por negocio:
 * `${issuerId}.${businessId}`; el objeto, uno por cliente.
 */
export function googleLoyaltyObject(m: PassModel, issuerId: string, classSuffix: string) {
  return {
    id: `${issuerId}.${m.serial}`,
    classId: `${issuerId}.${classSuffix}`,
    state: 'ACTIVE',
    accountId: m.serial,
    accountName: m.customerName,
    loyaltyPoints: { label: 'Sellos', balance: { string: m.progressText } },
    ...(m.nextReward || m.readyReward ? { secondaryLoyaltyPoints: { label: m.readyReward ? 'Premio listo' : 'Próximo premio', balance: { string: m.readyReward ?? m.nextReward!.title } } } : {}),
    barcode: { type: 'QR_CODE', value: m.cardUrl, alternateText: m.customerName },
    hexBackgroundColor: m.colors.bg,
    textModulesData: [{ id: 'estado', header: m.programName, body: headline(m) }],
    linksModuleData: { uris: [{ id: 'tarjeta', uri: m.cardUrl, description: 'Abrir mi tarjeta' }] },
    // merchantLocations (máx. 10): el campo `locations` de Google está obsoleto y no dispara avisos de cercanía.
    ...(m.locations.length ? { merchantLocations: m.locations.slice(0, 10).map((l) => ({ latitude: l.latitude, longitude: l.longitude })) } : {})
  };
}
