import type { ServerResponse } from "node:http";
import { toCsv, type CsvTable } from "./csv";

/** Una tabla para descargar: su nombre (sin extensión) y si se cortó por el tope de filas. */
export interface DownloadTable extends CsvTable {
  readonly name: string;
  readonly truncated: boolean;
}

/** Solo letras, números, guiones y puntos: el nombre nunca rompe la cabecera. */
const safeName = (name: string) => name.replace(/[^\w.-]+/g, "_").slice(0, 120) || "descarga";

/**
 * Envía una tabla como archivo CSV para descargar. Trae datos de clientes:
 * nunca se guarda en caché (`no-store`). `X-Export-Rows` y
 * `X-Export-Truncated` le dicen a la web cuántas filas trae y si se cortó.
 */
export function sendCsvFile(response: ServerResponse, table: DownloadTable): void {
  const body = toCsv(table);
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${safeName(table.name)}.csv"`);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Export-Rows", String(table.rows.length));
  response.setHeader("X-Export-Truncated", table.truncated ? "true" : "false");
  response.end(body);
}
