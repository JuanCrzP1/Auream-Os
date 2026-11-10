import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PixelEditor } from "@features/automations/builder/tools/pixel/PixelEditor";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { PixelConnectionSummary } from "@contracts/PixelContracts";
import type { PixelTestRequest } from "@contracts/PixelTestContracts";

// ---------------------------------------------------------------------------
// Editor del Pixel: solo ELIGE un píxel de la cuenta (como en Leona: se
// conectan y administran en Meta Ads), y «Probar» exige el código de prueba
// de Meta.
// ---------------------------------------------------------------------------

const VENTAS: PixelConnectionSummary = { id: "p1", name: "Ventas", pixelId: "3151000009796", tokenHint: "••••ZDZD", status: "active", lastVerifiedAt: null, createdAt: "x" };

function Editor({ resources, config = {} }: { resources: ToolResources; config?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Pixel", content: {}, config: { event: "lead", currency: "COP", ...config } });
  return (
    <>
      <PixelEditor draft={draft} resources={resources} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="config">{JSON.stringify(draft.config)}</output>
    </>
  );
}
const saved = () => JSON.parse(screen.getByTestId("config").textContent!) as Record<string, unknown>;

describe("PixelEditor", () => {
  it("sin píxeles no deja crear uno aquí: lleva a Meta Ads, en otra pestaña", () => {
    render(<Editor resources={{ labels: [], pixelConnections: [], pixelConnectionsStatus: "ready" }} />);

    const link = screen.getByRole("link", { name: "Conectar un píxel en Meta Ads" });
    expect(link).toHaveAttribute("href", "/meta-ads?tab=pixel");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByLabelText("Token de la API de Conversiones")).toBeNull();
    expect(screen.queryByRole("button", { name: /Conectar/ })).toBeNull();
  });

  it("mientras cargan los píxeles no dice que no hay ninguno", () => {
    render(<Editor resources={{ labels: [], pixelConnections: [], pixelConnectionsStatus: "loading" }} />);
    expect(screen.getByText("Cargando tus píxeles…")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no tienes píxeles conectados")).toBeNull();
  });

  it("con píxeles, se elige de la lista y se administran en Meta Ads; el ID viejo escrito en el bloque se descarta", async () => {
    render(<Editor resources={{ labels: [], pixelConnections: [VENTAS], pixelConnectionsStatus: "ready" }} config={{ pixelId: "999", platform: "meta" }} />);

    await userEvent.selectOptions(screen.getByLabelText("Píxel"), "p1");
    expect(saved()).toMatchObject({ connectionId: "p1" });
    expect(saved()).not.toHaveProperty("pixelId");
    expect(screen.getByRole("link", { name: "Administrar píxeles en Meta Ads" })).toHaveAttribute("href", "/meta-ads?tab=pixel");
    expect(screen.queryByRole("button", { name: /Conectar otro píxel/ })).toBeNull();
  });

  it("«Probar» exige el código de prueba y muestra lo que recibió Meta", async () => {
    const testPixel = vi.fn(async (_request: PixelTestRequest) => ({ ok: true as const, value: { succeeded: true, eventName: "Purchase", actionSource: "chat", value: 149900, currency: "COP", eventsReceived: 1, durationMs: 210, missingVariables: [] } }));
    render(<Editor resources={{ labels: [], pixelConnections: [VENTAS], pixelConnectionsStatus: "ready", testPixel }} config={{ connectionId: "p1", event: "purchase", value: "149.900" }} />);

    const send = screen.getByRole("button", { name: "Enviar evento de prueba" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Código de prueba de Meta"), "TEST12345");
    await userEvent.click(send);

    expect(testPixel.mock.calls[0]![0]).toMatchObject({ testEventCode: "TEST12345", config: { connectionId: "p1" } });
    expect(await screen.findByText("Meta recibió el evento")).toBeTruthy();
    expect(screen.getByText(/Purchase · conversación · 149\.900 COP/)).toBeTruthy();
  });
});
