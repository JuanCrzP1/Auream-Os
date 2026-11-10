import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ProductSummary, SaleListResponse, SaleSummary } from "@contracts/SalesContracts";
import { SalesPage } from "../../src/features/sales/pages/SalesPage";

// ---------------------------------------------------------------------------
// Ventas: totales por moneda (nunca mezcladas), «Por revisar» con su motivo y
// el botón para aprobarla, anular con motivo, anotar una venta y el catálogo
// con su precio por país. Lo que se puede tocar lo dice el servidor.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const VIDEO: ProductSummary = {
  id: "p1",
  name: "Video",
  description: "",
  kind: "main",
  status: "active",
  prices: [{ country: "CO", currency: "COP", amount: 49900 }],
  salesCount: 2,
  createdAt: "x",
  updatedAt: "x"
};

const sale = (over: Partial<SaleSummary>): SaleSummary => ({
  id: "s1",
  status: "approved",
  source: "receipt",
  productId: "p1",
  productName: "Video",
  amount: 49900,
  currency: "COP",
  country: "CO",
  customerName: "Laura",
  customerPhone: "573001112233",
  contactId: null,
  connectionName: "Ventas 1",
  flowName: "Flujo principal",
  adSourceId: "1202",
  receiptReference: "M-1",
  reviewReason: null,
  note: "",
  recordedByName: null,
  soldAt: "2026-11-01T15:00:00.000Z",
  ...over
});

const REVIEW = sale({ id: "s2", status: "review", amount: null, currency: null, customerName: "Pedro", reviewReason: "El comprobante no trajo el monto." });

let calls: Array<{ method: string; path: string; body: unknown }> = [];

function stubApi({ canManage = true, canRecord = true } = {}) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: `${url.pathname}${url.search}`, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/products" && method === "GET") return reply(200, { products: [VIDEO], canManage });
    if (url.pathname === "/products" && method === "POST") return reply(201, VIDEO);
    if (url.pathname === "/sales" && method === "GET") {
      const review = url.searchParams.get("status") === "review";
      const body: SaleListResponse = {
        sales: review ? [REVIEW] : [sale({}), sale({ id: "s3", amount: 12, currency: "USD", country: "VE", customerName: "Ana" }), REVIEW],
        totals: review ? [] : [{ currency: "COP", amount: 49900, count: 1 }, { currency: "USD", amount: 12, count: 1 }],
        reviewCount: 1,
        nextCursor: null,
        canRecord,
        canManage
      };
      return reply(200, body);
    }
    if (url.pathname === "/sales" && method === "POST") return reply(201, sale({ id: "s9" }));
    if (url.pathname.startsWith("/sales/") && method === "PATCH") return reply(200, sale({ id: "s2" }));
    return reply(404, { message: "no" });
  }));
}

const renderPage = (path = "/sales") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SalesPage />
    </MemoryRouter>
  );

beforeEach(() => vi.restoreAllMocks());

describe("Ventas", () => {
  it("totales por moneda (pesos y dólares nunca se suman) y la pestaña «Por revisar» con su número", async () => {
    stubApi();
    renderPage();
    const totals = await screen.findByRole("list", { name: "Totales del periodo" });
    expect(within(totals).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("$ 49.900 COP"),
      expect.stringContaining("$ 12 USD")
    ]);
    expect(screen.getByRole("tab", { name: "Por revisar · 1" })).toBeInTheDocument();
    expect(calls.find((call) => call.path.startsWith("/sales?"))?.path).toMatch(/from=\d{4}-\d{2}-\d{2}&to=/);
  });

  it("«Por revisar» muestra el motivo; al completarla se aprueba", async () => {
    stubApi();
    renderPage("/sales?tab=review");
    const row = await screen.findByRole("button", { name: /Venta de Pedro/ });
    expect(row).toHaveTextContent("El comprobante no trajo el monto.");
    expect(calls.some((call) => call.path.includes("status=review"))).toBe(true);

    await userEvent.click(row);
    const dialog = screen.getByRole("dialog", { name: "Revisar venta" });
    await userEvent.type(within(dialog).getByLabelText("Monto"), "49.900");
    await userEvent.selectOptions(within(dialog).getByLabelText("Moneda"), "COP");
    await userEvent.click(within(dialog).getByRole("button", { name: "Aprobar venta" }));
    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({ path: "/sales/s2", body: expect.objectContaining({ amount: "49.900", currency: "COP", status: "approved" }) });
  });

  it("anular exige escribir el motivo", async () => {
    stubApi();
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Venta de Laura/ }));
    const dialog = screen.getByRole("dialog", { name: "Venta" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Anular" }));
    const confirm = within(dialog).getByRole("button", { name: "Anular venta" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByPlaceholderText(/Pago falso/), "Pago falso");
    await userEvent.click(confirm);
    expect(calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ status: "void", voidReason: "Pago falso" });
  });

  it("anotar una venta propone el precio del producto en el país elegido", async () => {
    stubApi();
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Anotar venta" }));
    const dialog = screen.getByRole("dialog", { name: "Anotar venta" });
    await userEvent.selectOptions(within(dialog).getByLabelText("País del cliente"), "CO");
    await userEvent.selectOptions(within(dialog).getByLabelText("Producto"), "p1");
    expect(within(dialog).getByLabelText("Monto")).toHaveValue("49900");
    expect(within(dialog).getByLabelText("Moneda")).toHaveValue("COP");
    await userEvent.click(within(dialog).getByRole("button", { name: "Anotar venta" }));
    expect(calls.find((call) => call.method === "POST" && call.path === "/sales")?.body).toMatchObject({ productId: "p1", amount: "49900", currency: "COP", country: "CO" });
  });

  it("Productos: el catálogo con precio por país; crear uno nuevo", async () => {
    stubApi();
    renderPage("/sales?tab=products");
    const card = await screen.findByRole("button", { name: "Editar Video" });
    expect(card).toHaveTextContent("Colombia · $ 49.900 COP");
    expect(card).toHaveTextContent("2 ventas");

    await userEvent.click(screen.getByRole("button", { name: "Nuevo producto" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo producto" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Portada");
    await userEvent.click(within(dialog).getByRole("radio", { name: /Upsell/ }));
    await userEvent.type(within(dialog).getByLabelText("Precio en Colombia"), "15.000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear producto" }));
    expect(calls.find((call) => call.method === "POST" && call.path === "/products")?.body).toEqual({
      name: "Portada",
      description: "",
      kind: "upsell",
      status: "active",
      prices: [{ country: "CO", currency: "COP", amount: "15.000" }]
    });
  });

  it("Solo lectura: ve todo, sin anotar, revisar ni editar productos", async () => {
    stubApi({ canManage: false, canRecord: false });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Venta de Laura/ }));
    const dialog = screen.getByRole("dialog", { name: "Venta" });
    expect(within(dialog).queryByRole("button", { name: /Anular|Aprobar|Guardar/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("button", { name: "Anotar venta" })).toBeNull();
  });
});
