/** Utilidades CSV con neutralización de fórmulas (inyección en Excel/Sheets). */
export const CSV_BOM = '﻿';

/** Si la celda empieza con = + - @ (o tab/retorno), se antepone una comilla simple para que no se interprete como fórmula. */
export function neutralizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

export function csvCell(value: unknown): string {
  const s = neutralizeCell(String(value ?? ''));
  return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return CSV_BOM + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
