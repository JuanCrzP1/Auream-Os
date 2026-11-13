import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdsRepeatResponse } from "@contracts/AdsRepeatContracts";
import { PerformanceSection } from "../../src/features/ads/components/PerformanceSection";

// ---------------------------------------------------------------------------
// Meta Ads › Rendimiento › «Con recompras»: los clientes nuevos de cada
// campaña, su primera compra y lo que volvieron a comprar en la ventana
// (60 días por defecto; 30 o 90 a elegir), el ▲ de los que mejoran mucho y el
// aviso de que un periodo reciente aún está madurando.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const metrics = { spend: 400000, newCustomers: 12, firstRevenue: 600000, newRoas: 1.5, repeatCustomers: 5, repeatRevenue: 350000, windowRoas: 2.38 };
const repeat = (window: number): AdsRepeatResponse => ({
  currency: "COP", level: "campaign", window: window as 60, maturingDays: window === 90 ? 48 : 0, lastSyncedAt: null, connected: true,
  totals: metrics,
  rows: [
    { id: "c1", name: "Video Colombia · Mamás", level: "campaign", status: "ACTIVE", parentName: null, thumbnailUrl: null, lifted: true, ...metrics },
    { id: "c2", name: "Carrusel Navidad", level: "campaign", status: "PAUSED", parentName: null, thumbnailUrl: null, lifted: false, ...metrics, repeatCustomers: 0, repeatRevenue: 0, windowRoas: 1.5 }
  ]
});

function stub() {
  const calls: URLSearchParams[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(String(input), "http://api.test");
    if (url.pathname === "/dashboard/ads/repeat") {
      calls.push(url.searchParams);
      return reply(200, repeat(Number(url.searchParams.get("window"))));
    }
    if (url.pathname === "/dashboard/ads") return reply(200, { connected: true, rows: [], totals: { roas: 2, roasMeta: 1 }, currency: "COP", level: "campaign", unseenSales: 0, lateShare: null, lastSyncedAt: null });
    return reply(404, { message: "no" });
  }));
  return calls;
}

beforeEach(() => vi.restoreAllMocks());

describe("Con recompras", () => {
  it("muestra los clientes nuevos, la 1.ª compra, las recompras y el ROAS a 60 días; ▲ en los que mejoran mucho", async () => {
    const calls = stub();
    render(<PerformanceSection onConnectAccount={() => undefined} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Con recompras" }));
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: /ROAS a 60 días/ })).toBeInTheDocument();
    const [video, carrusel] = within(table).getAllByRole("row").slice(1, 3);
    expect(video).toHaveTextContent("Video Colombia · Mamás");
    expect(video).toHaveTextContent("5 clientes");
    expect(video).toHaveTextContent("2,4x");
    expect(within(video!).getByTitle(/Mejora mucho con las recompras/)).toBeInTheDocument();
    expect(within(carrusel!).queryByTitle(/Mejora mucho/)).not.toBeInTheDocument();
    expect(calls[0]!.get("window")).toBe("60");
    expect(calls[0]!.get("level")).toBe("campaign");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("al elegir 90 días pide esa ventana y avisa que el periodo aún está madurando", async () => {
    const calls = stub();
    render(<PerformanceSection onConnectAccount={() => undefined} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Con recompras" }));
    await userEvent.click(within(await screen.findByRole("group", { name: "Recompras" })).getByRole("button", { name: "a 90 días" }));
    expect(await screen.findByRole("note")).toHaveTextContent("faltan 48 días");
    expect(calls.at(-1)!.get("window")).toBe("90");
  });
});
