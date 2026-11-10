import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordSaleEditor } from "@features/automations/builder/tools/record-sale/RecordSaleEditor";
import { RecordSaleCompactBody } from "@features/automations/builder/tools/record-sale/RecordSaleCompactBody";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { ProductSummary } from "@contracts/SalesContracts";

// ---------------------------------------------------------------------------
// Editor de Registrar venta: solo ELIGE un producto del catálogo (se crean en
// Ventas → Productos, como los píxeles en Meta Ads), nace leyendo el
// comprobante y puede usar el precio del producto en el país del cliente.
// ---------------------------------------------------------------------------

const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: "p1",
  name: "Video personalizado",
  description: "",
  kind: "main",
  status: "active",
  prices: [{ country: "CO", currency: "COP", amount: 49900 }, { country: "VE", currency: "USD", amount: 12 }],
  salesCount: 0,
  createdAt: "x",
  updatedAt: "x",
  ...over
});

function Editor({ resources, config = {} }: { resources: ToolResources; config?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Registrar venta", content: {}, config });
  return (
    <>
      <RecordSaleEditor draft={draft} resources={resources} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="config">{JSON.stringify(draft.config)}</output>
    </>
  );
}
const saved = () => JSON.parse(screen.getByTestId("config").textContent!) as Record<string, unknown>;

describe("RecordSaleEditor", () => {
  it("sin productos no deja inventar uno: lleva a Ventas → Productos, en otra pestaña", () => {
    render(<Editor resources={{ labels: [], products: [], productsStatus: "ready" }} />);
    const link = screen.getByRole("link", { name: "Crear un producto en Ventas" });
    expect(link).toHaveAttribute("href", "/sales?tab=products");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("elige el producto (los archivados no se ofrecen) y muestra su precio en cada país", async () => {
    render(<Editor resources={{ labels: [], products: [product(), product({ id: "p2", name: "Viejo", status: "archived" })], productsStatus: "ready" }} />);
    expect(screen.queryByRole("option", { name: "Viejo" })).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Producto"), "p1");
    expect(saved()).toMatchObject({ productId: "p1", productName: "Video personalizado", amountMode: "variable", amount: "{comprobante.valor}", currency: "{comprobante.moneda}" });
    expect(screen.getByRole("list", { name: "Precios de Video personalizado" })).toHaveTextContent("Colombia · 49.900 COP");
  });

  it("con «Precio del producto» ya no pide monto ni moneda y avisa qué pasa si no hay precio en el país", async () => {
    render(<Editor resources={{ labels: [], products: [product()], productsStatus: "ready" }} config={{ productId: "p1" }} />);
    await userEvent.click(screen.getByRole("radio", { name: /Precio del producto/ }));
    expect(saved()).toMatchObject({ amountMode: "product" });
    expect(screen.queryByLabelText("Monto")).toBeNull();
    expect(screen.getByText(/no tiene precio en el país del cliente/)).toBeInTheDocument();
  });

  it("si el producto elegido se archivó, lo dice en vez de mostrar otro", () => {
    render(<Editor resources={{ labels: [], products: [product({ id: "p2", name: "Otro" })], productsStatus: "ready" }} config={{ productId: "p1" }} />);
    expect(screen.getByRole("option", { name: "El producto elegido ya no existe o se archivó" })).toBeInTheDocument();
  });

  it("el nodo cerrado muestra el producto y de dónde sale el monto", () => {
    const { rerender } = render(<RecordSaleCompactBody draft={{ name: "x", content: {}, config: {} }} />);
    expect(screen.getByText("Sin producto elegido")).toBeInTheDocument();
    rerender(<RecordSaleCompactBody draft={{ name: "x", content: {}, config: { productId: "p1", productName: "Video", amountMode: "product" } }} />);
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Precio del país")).toBeInTheDocument();
  });
});
