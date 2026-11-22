import type { CustomerSegment, DashboardData, Program } from '../contracts';

/**
 * Ideas de posts sacadas de los datos del negocio. Se calculan aquí (sin IA, sin costo); la IA solo escribe el texto
 * cuando el dueño elige una idea.
 */

export type InsightLayout = 'numero' | 'promo' | 'premio' | 'gracias';

export interface Insight {
  id: string;
  /** Lo que ve el dueño en la tarjeta de la idea. */
  title: string;
  detail: string;
  /** Hecho concreto que recibe la IA (en español, sin datos personales). */
  fact: string;
  /** Diseño sugerido para la imagen. */
  layout: InsightLayout;
  /** Cifra grande para el diseño "numero". */
  big?: string;
}

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface InsightInput {
  dash: DashboardData;           // últimos 30 días
  totalCustomers: number;
  segments: Partial<Record<CustomerSegment, number>>;
  program: Pick<Program, 'stampsRequired' | 'rewardTitle' | 'milestones' | 'birthdayReward'>;
  customerWord: string;          // "comensales", "clientes"…
  monthName: string;             // "noviembre"
}

/** Redondea hacia abajo a una cifra "celebrable": 47 → 40, 132 → 130, 1080 → 1.000. */
export function roundMilestone(n: number): number {
  if (n < 10) return n;
  if (n < 100) return Math.floor(n / 10) * 10;
  if (n < 1000) return Math.floor(n / 10) * 10;
  return Math.floor(n / 100) * 100;
}

export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { dash, program } = i;
  const k = dash.kpis;
  const w = i.customerWord;

  // 1) Comunidad: cuántos ya tienen la tarjeta.
  if (i.totalCustomers >= 10) {
    const n = roundMilestone(i.totalCustomers);
    out.push({
      id: 'comunidad', layout: 'numero', big: `+${n.toLocaleString('es-EC')}`,
      title: `Ya son más de ${n} en tu club`,
      detail: `${i.totalCustomers} ${w} tienen tu tarjeta de sellos. Celébralo e invita a más.`,
      fact: `El club de fidelidad del negocio ya tiene más de ${n} ${w} con su tarjeta de sellos. Queremos agradecer y animar a otros a unirse escaneando el QR en caja.`
    });
  }

  // 2) Día flojo: promo para mover ese día.
  const days = dash.byWeekday.filter((d) => d.stamps >= 0);
  const total = days.reduce((s, d) => s + d.stamps, 0);
  if (total >= 20 && days.length === 7) {
    const sorted = [...days].sort((a, b) => a.stamps - b.stamps);
    const low = sorted[0], high = sorted[sorted.length - 1];
    if (high.stamps > 0 && low.stamps < high.stamps * 0.8) {
      out.push({
        id: 'dia-flojo', layout: 'promo',
        title: `Dale vida al ${DAYS[low.weekday]}`,
        detail: `El ${DAYS[low.weekday]} es tu día más tranquilo (${low.stamps} sellos frente a ${high.stamps} del ${DAYS[high.weekday]}). Una promo puede llenarlo.`,
        fact: `El ${DAYS[low.weekday]} es el día con menos visitas del negocio. Queremos invitar a la gente a venir ese día. Propón una idea de promoción para el ${DAYS[low.weekday]} pero deja el beneficio concreto como [tu promoción] para que el dueño lo complete.`
      });
    }
  }

  // 3) Hora pico.
  const peak = [...dash.byHour].sort((a, b) => b.stamps - a.stamps)[0];
  if (peak && peak.stamps >= 5) {
    const h = `${peak.hour}:00`;
    out.push({
      id: 'hora-pico', layout: 'promo',
      title: `Tu hora pico: las ${h}`,
      detail: `A las ${h} llegan más ${w}. Aprovecha para recordarles su tarjeta.`,
      fact: `La hora con más movimiento del negocio son las ${h}. Queremos un post que invite a venir a esa hora y recuerde sumar su sello.`
    });
  }

  // 4) Premios entregados (prueba social).
  if (k.rewardsRedeemed >= 3) {
    out.push({
      id: 'premios', layout: 'numero', big: String(k.rewardsRedeemed),
      title: `${k.rewardsRedeemed} premios entregados este mes`,
      detail: 'Muestra que tu tarjeta sí regala. Es la mejor publicidad para que más se unan.',
      fact: `En los últimos 30 días el negocio entregó ${k.rewardsRedeemed} premios a sus ${w} gracias a la tarjeta de sellos. El premio principal es: ${program.rewardTitle}.`
    });
  }

  // 5) Premio de la tarjeta (y premios intermedios).
  const ms = (program.milestones ?? []).filter((m) => m.at < program.stampsRequired);
  out.push({
    id: 'premio', layout: 'premio',
    title: ms.length ? `Cuenta tus ${ms.length + 1} premios` : `Recuerda tu premio: ${program.rewardTitle}`,
    detail: ms.length
      ? `Tu tarjeta regala en el camino: ${ms.map((m) => `sello ${m.at}: ${m.title}`).join(', ')} y al final ${program.rewardTitle}.`
      : `Junta ${program.stampsRequired} sellos y gana ${program.rewardTitle}. Que todos lo sepan.`,
    fact: `La tarjeta de sellos del negocio: al juntar ${program.stampsRequired} sellos se gana ${program.rewardTitle}.` +
      (ms.length ? ` Además hay premios en el camino: ${ms.map((m) => `en el sello ${m.at}, ${m.title}`).join('; ')}.` : '') +
      ' Para empezar solo hay que escanear el QR en caja, sin descargar apps.'
  });

  // 6) Clientes que dejaron de venir (mensaje general, sin nombres).
  const risk = (i.segments.en_riesgo ?? 0) + (i.segments.inactivo ?? 0);
  if (risk >= 3) {
    out.push({
      id: 'te-extranamos', layout: 'gracias',
      title: 'Invita a volver a quienes no vienen',
      detail: `${risk} ${w} no vienen hace un tiempo. Un post de “te extrañamos” les recuerda que su tarjeta los espera.`,
      fact: `Varios ${w} con tarjeta no han vuelto en las últimas semanas. Queremos un post cálido de "te extrañamos" que recuerde que sus sellos siguen guardados y los esperan.`
    });
  }

  // 7) Cumpleañeros del mes.
  if (dash.upcomingBirthdays.length >= 2 && program.birthdayReward) {
    out.push({
      id: 'cumple', layout: 'gracias',
      title: `Cumpleañeros de ${i.monthName}`,
      detail: `Tienes ${w} de cumpleaños pronto. Recuérdales su regalo: ${program.birthdayReward}.`,
      fact: `El negocio regala "${program.birthdayReward}" en la semana del cumpleaños a quienes tienen su tarjeta. Queremos felicitar a los cumpleañeros de ${i.monthName} e invitar a registrarse para recibir el regalo.`
    });
  }

  // 8) Crecimiento de nuevos.
  const prev = dash.previous.newCustomers;
  if (k.newCustomers >= 5 && k.newCustomers > prev) {
    out.push({
      id: 'bienvenida', layout: 'gracias',
      title: `${k.newCustomers} nuevos este mes`,
      detail: `Se unieron ${k.newCustomers} ${w} nuevos${prev ? ` (antes ${prev})` : ''}. Dales la bienvenida.`,
      fact: `Este mes se unieron ${k.newCustomers} ${w} nuevos al club de sellos. Queremos darles la bienvenida y contar cómo funciona la tarjeta.`
    });
  }

  return out;
}
