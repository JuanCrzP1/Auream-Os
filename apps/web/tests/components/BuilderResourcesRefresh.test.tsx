import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { BuilderResourcesProvider, useBuilderResources } from "@features/automations/builder/context/BuilderResourcesContext";

// ---------------------------------------------------------------------------
// Recursos del editor: los píxeles se conectan en Meta Ads, que el bloque
// abre en otra pestaña. Al volver a la pestaña del editor, la lista se pide de
// nuevo sola: el píxel recién conectado aparece sin recargar.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const pixel = (id: string, name: string) => ({ id, name, pixelId: "3151000009796", tokenHint: "••••ZDZD", status: "active", lastVerifiedAt: null, createdAt: "x" });

let pixels = [pixel("p1", "Ventas")];

function PixelNames() {
  const { pixelConnections = [] } = useBuilderResources();
  return <output data-testid="pixels">{pixelConnections.map((connection) => connection.name).join(", ")}</output>;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

beforeEach(() => {
  pixels = [pixel("p1", "Ventas")];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(String(input), "http://api.test");
      if (url.pathname === "/pixel-connections") return reply(200, { connections: pixels });
      return reply(404, { message: "no" });
    })
  );
});

afterEach(() => {
  // Vuelve al getter del navegador simulado.
  Reflect.deleteProperty(document, "visibilityState");
});

describe("BuilderResourcesProvider", () => {
  it("al volver a la pestaña del editor vuelve a pedir los píxeles, y no al salir de ella", async () => {
    render(
      <BuilderResourcesProvider>
        <PixelNames />
      </BuilderResourcesProvider>
    );
    expect(await screen.findByText("Ventas")).toBeInTheDocument();

    // En Meta Ads (otra pestaña) se conecta un segundo píxel…
    pixels = [pixel("p1", "Ventas"), pixel("p2", "Marca 2")];

    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByTestId("pixels")).toHaveTextContent(/^Ventas$/);

    // …y al volver al editor aparece solo.
    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(await screen.findByText("Ventas, Marca 2")).toBeInTheDocument();
  });
});
