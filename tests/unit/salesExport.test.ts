import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../../apps/api/http/csv.js";
import type { FxRates } from "../../domains/analytics/application/CurrencyConverter.js";
import type { AdsReader } from "../../domains/analytics/application/DashboardReaders.js";
import { DashboardScopeResolver } from "../../domains/analytics/application/DashboardScopeResolver.js";
import { phoneText } from "../../domains/analytics/application/SalesExportTable.js";
import { SalesExportService, type SaleExportRow, type SalesExportReader } from "../../domains/analytics/application/SalesExportService.js";

// ---------------------------------------------------------------------------
// Descargar ventas: una tabla con cada venta (monto original y convertido con
// la tasa de su día), y un CSV que Excel abre bien en español y que no
// ejecuta fórmulas escondidas en un nombre de cliente.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-10T22:00:00.000Z");
const fx: FxRates = { table: async () => new Map([["2026-11-01", new Map([["COP", 4000]])]]), refresh: async () => {} };
const ads = { status: async () => ({ accounts: 1, lastSyncedAt: null, mainCurrency: "COP", activeCampaigns: 1 }) } as unknown as AdsReader;
const sale = (extra: Partial<SaleExportRow>): SaleExportRow => ({
  id: "s1", day: "2026-11-05", time: "11:00", customerName: "Laura", customerPhone: "573013815302", country: "CO", productName: "Video",
  amount: 50_000, currency: "COP", connectionName: "Ventas 1", fromAd: true, hasAdSource: true, campaignName: "Video Colombia", adName: "Tu canción",
  source: "receipt", receiptReference: "TX-9", note: "", ...extra
});

describe("descargar ventas", () => {
  it("una fila por venta con el monto convertido a la moneda de reporte; sin tasa queda vacío", async () => {
    const asked: Array<{ limit: number; scope: unknown }> = [];
    const reader: SalesExportReader = {
      rows: async (_t, _p, scope, _tz, limit) => {
        asked.push({ limit, scope });
        return [sale({}), sale({ id: "s2", amount: 12, currency: "USD", fromAd: false, hasAdSource: false, campaignName: null, adName: null, connectionName: null, source: "manual" }), sale({ id: "s3", amount: 900, currency: "XYZ", fromAd: false, campaignName: null })];
      }
    };
    const table = await new SalesExportService(reader, ads, fx, async () => "America/Bogota", new DashboardScopeResolver(), () => NOW)
      .export("t", { from: "2026-11-01", to: "2026-11-10", productIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] });
    expect(asked[0]).toEqual({ limit: 20_001, scope: { productIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] } });
    expect(table.name).toBe("ventas_2026-11-01_a_2026-11-10");
    expect(table.columns).toContain("Monto en COP");
    expect(table.rows[0]).toEqual(["2026-11-05", "11:00", "Laura", "57 301 381 5302", "CO", "Video", 50_000, "COP", 50_000, "Ventas 1", "Anuncio", "Video Colombia", "Tu canción", "Comprobante en el chat", "TX-9", null, "s1"]);
    const [, usd, unknown] = table.rows;
    expect([usd![8], usd![9], usd![10], usd![13]]).toEqual([48_000, "Anotada a mano", "Orgánica", "Anotada a mano"]);
    expect(unknown![8]).toBeNull();
    expect(unknown![10]).toBe("Anuncio (cuenta o campaña no conectada)");
    expect(table.missingRates).toEqual(["XYZ"]);
    expect(table.truncated).toBe(false);
  });

  it("con más ventas que el tope, se corta y lo dice", async () => {
    const reader: SalesExportReader = { rows: async (_t, _p, _s, _tz, limit) => Array.from({ length: limit }, (_, i) => sale({ id: `s${i}` })) };
    const table = await new SalesExportService(reader, ads, fx, async () => "America/Bogota", undefined, () => NOW, 3).export("t", {});
    expect([table.rows.length, table.truncated]).toEqual([3, true]);
  });

  it("el teléfono con su indicativo y espacios (texto en la hoja)", () => {
    expect(phoneText("573013815302")).toBe("57 301 381 5302");
    expect(phoneText("15512345678")).toBe("1 551 234 5678");
    expect(phoneText("584121234567")).toBe("58 412 123 4567");
  });
});

describe("CSV para Excel en español", () => {
  it("BOM, «;», decimales con coma, comillas y saltos de línea CRLF", () => {
    const csv = toCsv({ columns: ["Cliente", "Monto"], rows: [["Peña; \"La\" ñ", 1234.5], ["Línea\nnueva", null]] });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('Cliente;Monto\r\n"Peña; ""La"" ñ";1234,5\r\n"Línea\nnueva";\r\n');
  });

  it("un texto que empieza como fórmula no se ejecuta en la hoja; los números negativos sí son números", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+57 300")).toBe("'+57 300");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-30_000)).toBe("-30000");
    expect(csvCell(0.1 + 0.2)).toBe("0,3");
  });
});
