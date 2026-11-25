import { describe, expect, it } from 'vitest';
import type { AdminTask } from '@/lib/contracts';
import {
  aiRatioWarn, daysLeftLabel, ecGreeting, ecLongDate, formatRatio, formatUsd, groupTasks, lastStampLabel,
  moneyLineMessage, parseDaysRange, taskContact, taskMessage, taskSummary
} from './helpers';

const task = (p: Partial<AdminTask> & Pick<AdminTask, 'kind' | 'severity'>): AdminTask => ({
  id: `${p.kind}:${p.businessId ?? 'b1'}`, businessId: 'b1', businessName: 'Café Lucía', label: 'x', reason: 'y', ...p
});

describe('saludo y fecha en hora de Ecuador', () => {
  it('usa UTC-5', () => {
    expect(ecGreeting(Date.parse('2026-11-25T13:00:00Z'))).toBe('Buenos días');    // 08:00
    expect(ecGreeting(Date.parse('2026-11-25T17:00:00Z'))).toBe('Buenas tardes');  // 12:00
    expect(ecGreeting(Date.parse('2026-11-26T00:30:00Z'))).toBe('Buenas noches');  // 19:30
    expect(ecGreeting(Date.parse('2026-11-26T04:00:00Z'))).toBe('Buenas noches');  // 23:00 del 25
  });
  it('fecha larga', () => {
    expect(ecLongDate(Date.parse('2026-11-26T04:00:00Z'))).toBe('Miércoles 25 de noviembre de 2026');
  });
});

describe('Hoy te toca', () => {
  const tasks = [
    task({ kind: 'plan_expired', severity: 'critical', businessId: 'a' }),
    task({ kind: 'payment_due', severity: 'warning', businessId: 'b' }),
    task({ kind: 'payment_due', severity: 'warning', businessId: 'c' }),
    task({ kind: 'inactive', severity: 'critical', businessId: 'd' }),
    task({ kind: 'invite_expired', severity: 'warning', businessId: 'e' })
  ];
  it('resumen con conteos en singular y plural', () => {
    expect(taskSummary(tasks)).toBe('1 plan vencido · 2 cobros esta semana · 1 negocio inactivo · 1 invitación vencida');
    expect(taskSummary([])).toBe('');
  });
  it('agrupa por gravedad sin grupos vacíos', () => {
    const g = groupTasks(tasks);
    expect(g.map((x) => x.severity)).toEqual(['critical', 'warning']);
    expect(g[0].tasks.map((t) => t.businessId)).toEqual(['a', 'd']);
  });
  it('mensaje de cobro con monto y plazo', () => {
    const m = taskMessage({ kind: 'payment_due', businessName: 'Café Lucía', amountCents: 5499, days: 3 });
    expect(m).toContain('vence en 3 días');
    expect(m).toContain('$54,99');
    expect(taskMessage({ kind: 'payment_due', businessName: 'X', days: 1 })).toContain('vence mañana');
    expect(taskMessage({ kind: 'setup_stuck', businessName: 'Negocio nuevo · configurando' })).toContain('configurar Negocio nuevo.');
  });
  it('prefiere WhatsApp y si no hay celular usa correo', () => {
    const wa = taskContact(task({ kind: 'inactive', severity: 'warning', ownerPhone: '+593991234567', ownerEmail: 'a@b.com' }));
    expect(wa?.channel).toBe('whatsapp');
    expect(wa?.href.startsWith('https://wa.me/593991234567?text=')).toBe(true);
    const mail = taskContact(task({ kind: 'inactive', severity: 'warning', ownerEmail: 'a@b.com' }));
    expect(mail?.channel).toBe('email');
    expect(mail?.href.startsWith('mailto:a@b.com?subject=')).toBe(true);
    expect(taskContact(task({ kind: 'inactive', severity: 'warning' }))).toBeNull();
  });
  it('mensaje de una línea de dinero según esté vencida o no', () => {
    expect(moneyLineMessage({ businessName: 'X', amountCents: 100, days: -2 })).toContain('ya venció');
    expect(moneyLineMessage({ businessName: 'X', amountCents: 100, days: 0 })).toContain('vence hoy');
  });
});

describe('etiquetas', () => {
  it('días que faltan o pasaron', () => {
    expect(daysLeftLabel(0)).toBe('Hoy');
    expect(daysLeftLabel(1)).toBe('Mañana');
    expect(daysLeftLabel(12)).toBe('En 12 días');
    expect(daysLeftLabel(-1)).toBe('Venció ayer');
    expect(daysLeftLabel(-5)).toBe('Venció hace 5 días');
  });
  it('último sello', () => {
    expect(lastStampLabel(null)).toBe('Nunca');
    expect(lastStampLabel(0)).toBe('Hoy');
    expect(lastStampLabel(1)).toBe('Ayer');
    expect(lastStampLabel(9)).toBe('Hace 9 días');
  });
  it('rango 30 por defecto', () => {
    expect(parseDaysRange(undefined)).toBe(30);
    expect(parseDaysRange('90')).toBe(90);
    expect(parseDaysRange('7')).toBe(30);
    expect(parseDaysRange(['90'])).toBe(30);
  });
  it('costo de IA', () => {
    expect(aiRatioWarn(0.3)).toBe(false);
    expect(aiRatioWarn(0.31)).toBe(true);
    expect(formatUsd(0.001)).toBe('< $0,01');
    expect(formatUsd(0)).toBe('$0,00');
    expect(formatRatio(0.05)).toMatch(/^5,0 %$/);
    expect(formatRatio(0.42)).toBe('42 %');
  });
});
