// ---------------------------------------------------------------------------
// Una tabla a CSV que Excel y Google Sheets abren bien en español:
//
//   - UTF-8 con BOM (si no, Excel rompe las tildes y la ñ);
//   - separador «;» y decimales con coma (el formato regional de Latinoamérica);
//   - saltos de línea CRLF y comillas según RFC 4180;
//   - protección contra «inyección de fórmulas»: un texto que empieza con
//     = + - @ (o tab / retorno) se antepone con ' para que la hoja no lo
//     ejecute. Un nombre de cliente como «=HYPERLINK(...)» queda como texto.
//
// Puro: no sabe de ventas ni de HTTP.
// ---------------------------------------------------------------------------

export type CsvValue = string | number | null;

export interface CsvTable {
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<CsvValue>>;
}

const SEPARATOR = ";";
const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

/** Un número con coma decimal y sin separador de miles («1234,5»). */
function numberCell(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

function textCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvCell(value: CsvValue): string {
  if (value === null) return "";
  return typeof value === "number" ? numberCell(value) : textCell(value);
}

export function toCsv(table: CsvTable): string {
  const lines = [table.columns, ...table.rows].map((row) => row.map(csvCell).join(SEPARATOR));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
