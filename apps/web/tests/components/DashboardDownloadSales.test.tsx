import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/features/dashboard/pages/DashboardPage";
import { filenameOf } from "../../src/shared/http/HttpClient";

// ---------------------------------------------------------------------------
// Descargar ventas: solo quien puede (trae teléfonos); baja el CSV de lo que
// se mira con el nombre que da el servidor y dice cuántas trajo o si se cortó.
// ---------------------------------------------------------------------------

const json = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const trend = (value: number) => ({ value, previous: 0, change: null });
const SALES = (canExport: boolean, sales = 120) => ({
  currency: "COP", missingRates: [], revenue: trend(100), sales: trend(sales), averageTicket: 100, leads: trend(1), leadsFromAds: 0, conversion: 1, conversionPrevious: null, convertedLeads: 1,
  reviewCount: 0, ads: null, realProfit: null, profit: trend(100), otherSpend: null, otherExpenses: [], costsKnown: false, daily: [], funnel: null, byHour: Array(24).fill(0),
  byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true, canExport
});

let paths: string[] = [];
let saved: Array<{ name: string }> = [];
function stub(canExport: boolean, file: { rows: string; truncated: string } | "error" = { rows: "120", truncated: "false" }) {
  paths = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(String(input), "http://api.test");
    paths.push(url.pathname + url.search);
    if (url.pathname === "/dashboard/sales/export") {
      if (file === "error") return json(500, { message: "x" });
      const headers = new Headers({ "Content-Disposition": 'attachment; filename="ventas_2026-10-01_a_2026-10-31.csv"', "X-Export-Rows": file.rows, "X-Export-Truncated": file.truncated });
      return { ok: true, status: 200, headers, blob: async () => new Blob(["﻿Fecha;Hora\r\n"]) } as unknown as Response;
    }
    if (url.pathname === "/dashboard/sales") return json(200, SALES(canExport));
    if (url.pathname === "/ads/accounts") return json(403, {});
    if (url.pathname === "/connections") return json(200, { connections: [] });
    if (url.pathname === "/products") return json(200, { products: [], canManage: false });
    if (url.pathname === "/sales-lines") return json(200, { lines: [], canManage: false });
    return json(404, {});
  }));
}

beforeEach(() => {
  saved = [];
  vi.restoreAllMocks();
  window.localStorage.clear();
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ name: this.download });
  });
});

const page = (path = "/dashboard") => render(<MemoryRouter initialEntries={[path]}><DashboardPage /></MemoryRouter>);

describe("Descargar ventas", () => {
  it("baja el CSV de lo que se mira, con el nombre del servidor, y dice cuántas trajo", async () => {
    stub(true);
    page("/dashboard?period=lastMonth&line=33333333-3333-4333-8333-333333333333&currency=USD");
    await userEvent.click(await screen.findByRole("button", { name: "Descargar 120 ventas" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Listo: 120 ventas.");
    expect(saved).toEqual([{ name: "ventas_2026-10-01_a_2026-10-31.csv" }]);
    const asked = paths.find((p) => p.startsWith("/dashboard/sales/export"))!;
    expect(asked).toMatch(/from=.*&to=.*/);
    expect(asked).toContain("line=33333333-3333-4333-8333-333333333333");
    expect(asked).toContain("currency=USD");
  });

  it("si pasa del tope, avisa que eligió menos días; si falla, lo dice", async () => {
    stub(true, { rows: "20000", truncated: "true" });
    const first = page();
    await userEvent.click(await screen.findByRole("button", { name: /Descargar 120 ventas/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Se descargaron las 20.000 más recientes. Para el resto, elige menos días.");
    first.unmount();

    stub(true, "error");
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Descargar 120 ventas/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se pudo descargar."));
    expect(saved).toHaveLength(1);
  });

  it("sin permiso (Asesor, Solo lectura) no hay botón", async () => {
    stub(false);
    page();
    await screen.findByRole("region", { name: "Resumen del periodo" });
    expect(screen.queryByRole("button", { name: /Descargar/ })).not.toBeInTheDocument();
  });

  it("lee el nombre del archivo de la cabecera", () => {
    expect(filenameOf('attachment; filename="ventas_2026-10-01_a_2026-10-31.csv"')).toBe("ventas_2026-10-01_a_2026-10-31.csv");
    expect(filenameOf("attachment; filename*=UTF-8''ventas%20oct.csv")).toBe("ventas oct.csv");
    expect(filenameOf(null)).toBeNull();
  });
});
