import type { BusinessType, Program } from './contracts';

/**
 * Plantillas por tipo de negocio. El panel es el mismo para todos; cambian el vocabulario y los valores iniciales.
 * Cualquier texto de interfaz que nombre "visita", "caja", "cliente", "premio" debe salir de aquí.
 */
export interface Vocabulary {
  visit: string; visits: string;            // "visita" / "asistencia" / "compra"
  customer: string; customers: string;      // "cliente" / "socio" / "comensal"
  counter: string;                          // "Caja" / "Recepción" / "Mostrador"
  ticket: string;                           // "Ticket" / "Factura" / "Ficha"
  reward: string;                           // "premio" / "regalo"
  staffRole: string;                        // "cajero" / "recepcionista" / "vendedor"
  people: string;                           // "¿Para cuántas personas?" / "¿Para cuántos arreglos?"
}

export interface BusinessTemplate {
  type: BusinessType;
  label: string;
  tagline: string;
  vocab: Vocabulary;
  program: Pick<Program,
    'name' | 'stampsRequired' | 'rewardTitle' | 'rewardDescription' | 'requireAmount' | 'minSpendCentsPerStamp' |
    'codeTtlSeconds' | 'maxSeatsWithoutApproval' | 'cooldownMinutes' | 'colors' | 'birthdayReward'>;
  rewardIdeas: string[];
}

const std = { codeTtlSeconds: 300, maxSeatsWithoutApproval: 4 };
const v = (o: Partial<Vocabulary>): Vocabulary => ({
  visit: 'visita', visits: 'visitas', customer: 'cliente', customers: 'clientes', counter: 'Caja', ticket: 'Ticket',
  reward: 'premio', staffRole: 'cajero', people: '¿Para cuántas personas?', ...o
});

export const TEMPLATES: Record<BusinessType, BusinessTemplate> = {
  restaurante: {
    type: 'restaurante', label: 'Restaurante', tagline: 'Comensales que vuelven',
    vocab: v({ customer: 'comensal', customers: 'comensales', ticket: 'Cuenta', staffRole: 'mesero o cajero' }),
    program: { name: 'Club de comensales', stampsRequired: 8, rewardTitle: 'Postre de la casa', rewardDescription: 'Un postre a elección en tu próxima visita', requireAmount: true, minSpendCentsPerStamp: 800, cooldownMinutes: 0, ...std, colors: { bg: '#001D3D', accent: '#F28C6B', ink: '#FFFFFF' }, birthdayReward: 'Postre de cumpleaños' },
    rewardIdeas: ['Postre de la casa', 'Entrada gratis', 'Bebida gratis', '10 % en tu cuenta']
  },
  cafeteria: {
    type: 'cafeteria', label: 'Cafetería', tagline: 'Un café más, un cliente fiel',
    vocab: v({ ticket: 'Ticket' }),
    program: { name: 'Tarjeta de cafés', stampsRequired: 10, rewardTitle: 'Café gratis', rewardDescription: 'Un café a elección', requireAmount: true, minSpendCentsPerStamp: 250, cooldownMinutes: 0, ...std, colors: { bg: '#001D3D', accent: '#D9A86C', ink: '#FFFFFF' }, birthdayReward: 'Un café de regalo' },
    rewardIdeas: ['Café gratis', 'Postre gratis', 'Café + snack', 'Bebida grande gratis']
  },
  gimnasio: {
    type: 'gimnasio', label: 'Gimnasio', tagline: 'Constancia que se premia',
    vocab: v({ visit: 'asistencia', visits: 'asistencias', customer: 'socio', customers: 'socios', counter: 'Recepción', ticket: 'Ficha', staffRole: 'recepcionista', people: '¿Cuántos socios entran?' }),
    program: { name: 'Constancia', stampsRequired: 12, rewardTitle: 'Clase personalizada', rewardDescription: 'Una sesión con entrenador', requireAmount: false, minSpendCentsPerStamp: 0, cooldownMinutes: 240, ...std, colors: { bg: '#001D3D', accent: '#5BD69B', ink: '#FFFFFF' }, birthdayReward: 'Pase de invitado' },
    rewardIdeas: ['Clase personalizada', 'Pase de invitado', 'Batido gratis', 'Una semana gratis']
  },
  floristeria: {
    type: 'floristeria', label: 'Floristería', tagline: 'Flores para volver',
    vocab: v({ visit: 'compra', visits: 'compras', ticket: 'Factura', staffRole: 'vendedor', people: '¿Cuántos arreglos?' }),
    program: { name: 'Club de flores', stampsRequired: 6, rewardTitle: 'Ramo pequeño gratis', rewardDescription: 'Un ramo de temporada', requireAmount: true, minSpendCentsPerStamp: 1000, cooldownMinutes: 0, ...std, colors: { bg: '#001D3D', accent: '#F5A3C7', ink: '#FFFFFF' }, birthdayReward: 'Una flor de cumpleaños' },
    rewardIdeas: ['Ramo pequeño gratis', '20 % en tu próximo ramo', 'Tarjeta de regalo', 'Envío gratis']
  },
  barberia: {
    type: 'barberia', label: 'Barbería', tagline: 'Cada corte suma',
    vocab: v({ visit: 'corte', visits: 'cortes', counter: 'Caja', staffRole: 'barbero o cajero' }),
    program: { name: 'Cliente frecuente', stampsRequired: 10, rewardTitle: 'Corte gratis', rewardDescription: 'Un corte clásico', requireAmount: true, minSpendCentsPerStamp: 500, cooldownMinutes: 1440, ...std, colors: { bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF' }, birthdayReward: 'Corte de cumpleaños' },
    rewardIdeas: ['Corte gratis', 'Barba gratis', 'Producto de regalo', '50 % en tu corte']
  },
  peluqueria: {
    type: 'peluqueria', label: 'Peluquería y salón', tagline: 'Belleza con recompensa',
    vocab: v({ visit: 'cita', visits: 'citas', staffRole: 'recepcionista' }),
    program: { name: 'Club de belleza', stampsRequired: 8, rewardTitle: 'Tratamiento gratis', rewardDescription: 'Un tratamiento capilar', requireAmount: true, minSpendCentsPerStamp: 1200, cooldownMinutes: 1440, ...std, colors: { bg: '#001D3D', accent: '#C9A7F5', ink: '#FFFFFF' }, birthdayReward: 'Peinado de cumpleaños' },
    rewardIdeas: ['Tratamiento gratis', 'Manicure gratis', '20 % en tu servicio']
  },
  panaderia: {
    type: 'panaderia', label: 'Panadería', tagline: 'Pan de cada día, con premio',
    vocab: v({ visit: 'compra', visits: 'compras' }),
    program: { name: 'Tarjeta del pan', stampsRequired: 10, rewardTitle: 'Combo gratis', rewardDescription: 'Pan y bebida del día', requireAmount: true, minSpendCentsPerStamp: 300, cooldownMinutes: 0, ...std, colors: { bg: '#001D3D', accent: '#E6B65C', ink: '#FFFFFF' }, birthdayReward: 'Un pastel pequeño' },
    rewardIdeas: ['Combo gratis', 'Docena de panes', 'Pastel pequeño']
  },
  tienda: {
    type: 'tienda', label: 'Tienda', tagline: 'Compras que se premian',
    vocab: v({ visit: 'compra', visits: 'compras', ticket: 'Factura', staffRole: 'vendedor' }),
    program: { name: 'Club de compras', stampsRequired: 10, rewardTitle: '$5 de descuento', rewardDescription: 'Descuento en tu próxima compra', requireAmount: true, minSpendCentsPerStamp: 1000, cooldownMinutes: 0, ...std, colors: { bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF' }, birthdayReward: '10 % en tu cumpleaños' },
    rewardIdeas: ['$5 de descuento', 'Producto de regalo', 'Envío gratis']
  },
  spa: {
    type: 'spa', label: 'Spa', tagline: 'Bienestar frecuente',
    vocab: v({ visit: 'sesión', visits: 'sesiones', counter: 'Recepción', staffRole: 'recepcionista' }),
    program: { name: 'Club de bienestar', stampsRequired: 8, rewardTitle: 'Masaje de 30 min', rewardDescription: 'Un masaje express', requireAmount: true, minSpendCentsPerStamp: 2000, cooldownMinutes: 1440, ...std, colors: { bg: '#001D3D', accent: '#8FD3C8', ink: '#FFFFFF' }, birthdayReward: 'Mascarilla de cumpleaños' },
    rewardIdeas: ['Masaje de 30 min', 'Facial gratis', '25 % en tu sesión']
  },
  otro: {
    type: 'otro', label: 'Otro negocio', tagline: 'Fidelidad a tu medida',
    vocab: v({}),
    program: { name: 'Tarjeta de sellos', stampsRequired: 10, rewardTitle: 'Premio de la casa', rewardDescription: 'Tu recompensa por ser cliente frecuente', requireAmount: true, minSpendCentsPerStamp: 500, cooldownMinutes: 0, ...std, colors: { bg: '#001D3D', accent: '#FFC301', ink: '#FFFFFF' }, birthdayReward: 'Un detalle por tu cumpleaños' },
    rewardIdeas: ['Producto gratis', 'Descuento', 'Servicio gratis']
  }
};

export const BUSINESS_TYPES = Object.values(TEMPLATES);
export function getTemplate(type: BusinessType): BusinessTemplate { return TEMPLATES[type] ?? TEMPLATES.otro; }
