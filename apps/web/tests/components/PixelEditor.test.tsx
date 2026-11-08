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
// Editor del Pixel: elige un píxel de la cuenta (o lo conecta sin salir), y
// «Probar» exige el código de prueba de Meta.
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
  it("sin píxeles, conecta uno desde el bloque y lo elige (el token no queda en el flujo)", async () => {
    const createPixelConnection = vi.fn(async () => ({ ok: true as const, value: { ...VENTAS, id: "nuevo" } }));
    render(<Editor resources={{ labels: [], pixelConnections: [], pixelConnectionsStatus: "ready", createPixelConnection }} />);

    await userEvent.type(screen.getByLabelText("ID del píxel (conjunto de datos)"), "3151000009796");
    await userEvent.type(screen.getByLabelText("Token de la API de Conversiones"), "EAAOtokenDePruebaMuyLargo0123456789ZDZD");
    await userEvent.click(screen.getByRole("button", { name: "Conectar píxel" }));

    expect(createPixelConnection).toHaveBeenCalledWith({ name: "Píxel 9796", pixelId: "3151000009796", accessToken: "EAAOtokenDePruebaMuyLargo0123456789ZDZD" });
    expect(saved()).toMatchObject({ connectionId: "nuevo" });
    expect(JSON.stringify(saved())).not.toContain("EAAO");
  });

  it("con píxeles, se elige de la lista; el ID viejo escrito en el bloque se descarta", async () => {
    render(<Editor resources={{ labels: [], pixelConnections: [VENTAS], pixelConnectionsStatus: "ready" }} config={{ pixelId: "999", platform: "meta" }} />);

    await userEvent.selectOptions(screen.getByLabelText("Píxel"), "p1");
    expect(saved()).toMatchObject({ connectionId: "p1" });
    expect(saved()).not.toHaveProperty("pixelId");
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
