import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AutomationFlowCard } from "../../src/features/automations/list/components/AutomationFlowCard";
import type { AutomationSummary } from "@contracts/AutomationContracts";

const flow: AutomationSummary = {
  id: "id-1",
  key: "flow-key-1",
  name: "Mi flujo de prueba",
  status: "active",
  updatedAt: "2024-06-15T00:00:00.000Z",
  tags: ["soporte", "ventas"],
  nodeCount: 6,
  connectionStatus: "connected"
};

function renderCard(f: AutomationSummary = flow, props: Partial<{ onDelete: (f: AutomationSummary) => void; onRename: (f: AutomationSummary) => void }> = {}) {
  return render(
    <MemoryRouter initialEntries={["/automations"]}>
      <Routes>
        <Route path="/automations" element={<AutomationFlowCard flow={f} {...props} />} />
        <Route path="/builder/:flowKey" element={<div>Builder page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AutomationFlowCard", () => {
  it("renders flow name", () => {
    renderCard();
    expect(screen.getByText("Mi flujo de prueba")).toBeInTheDocument();
  });

  it("no muestra ningún distintivo de estado", () => {
    // Las automatizaciones se guardan solas, así que «Borrador» aparecía en
    // todas y no informaba de nada: se retiró y el nombre ocupa ese ancho.
    renderCard();

    expect(screen.queryByText("Activo")).not.toBeInTheDocument();
    expect(screen.queryByText("Borrador")).not.toBeInTheDocument();
    expect(document.querySelector(".hub-card__status")).toBeNull();
  });

  it("renders tags", () => {
    renderCard();
    expect(screen.getByText("soporte")).toBeInTheDocument();
    expect(screen.getByText("ventas")).toBeInTheDocument();
  });

  it("renders date", () => {
    renderCard();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it("renderiza el contador derivado, el SVG de herramientas y estado conectado", () => {
    renderCard();

    expect(screen.getByLabelText("6 nodos")).toBeInTheDocument();
    expect(document.querySelector(".hub-card__tools-icon svg")).not.toBeNull();
    expect(screen.getByLabelText("Estructura conectada")).toHaveClass("hub-card__connection-status--connected");
  });

  it("renderiza estado desconectado", () => {
    renderCard({ ...flow, connectionStatus: "disconnected" });
    expect(screen.getByLabelText("Estructura desconectada")).toHaveClass("hub-card__connection-status--disconnected");
  });

  it("omite el resumen entero cuando la respuesta no trae los campos", () => {
    // El caso real que ocurrió: una API sin `nodeCount` ni `connectionStatus`.
    // El tipo los declara obligatorios, pero el JSON de la red no lo garantiza
    // y `builderApiClient` no valida. Sin el guardia, la tarjeta pintaba un
    // icono sin número y un punto con la clase `--undefined` —sin regla CSS, o
    // sea invisible— y encima lo anunciaba como «Estructura desconectada»,
    // afirmando algo que nadie ha comprobado.
    const { nodeCount: _n, connectionStatus: _c, ...sinResumen } = flow;
    renderCard(sinResumen as AutomationSummary);

    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(document.querySelector(".hub-card__node-count")).toBeNull();
    expect(document.querySelector(".hub-card__connection-status")).toBeNull();
    expect(document.querySelector(".hub-card__separator")).toBeNull();
    expect(screen.queryByLabelText("Estructura desconectada")).not.toBeInTheDocument();
  });

  it("conserva la altura fija de 99 px", () => {
    const hubCardCss = readFileSync(
      "src/features/automations/list/components/hub-card.css",
      "utf8"
    );
    expect(hubCardCss).toMatch(/\.hub-card\s*\{[\s\S]*?height:\s*99px;[\s\S]*?min-height:\s*99px;[\s\S]*?max-height:\s*99px;/);
  });

  it("navigates to builder on card click", async () => {
    renderCard();
    // Hacer clic en el nombre del flow (dentro del card, fuera del menú)
    await userEvent.click(screen.getByText("Mi flujo de prueba"));
    expect(screen.getByText("Builder page")).toBeInTheDocument();
  });

  it("el estado tampoco aparece cuando es otro", () => {
    // El dato sigue en el modelo; lo que se retiró es su representación.
    renderCard({ ...flow, status: "paused" });

    expect(screen.queryByText("Pausado")).not.toBeInTheDocument();
    expect(screen.getByText(flow.name)).toBeInTheDocument();
  });

  // ---- Context menu ----

  it("renderiza el botón de menú de la card", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /acciones para/i })).toBeInTheDocument();
  });

  it("abre el menú al hacer clic en el botón de 3 puntos", async () => {
    renderCard();
    const menuBtn = screen.getByRole("button", { name: /acciones para/i });
    await userEvent.click(menuBtn);
    expect(screen.getByRole("menuitem", { name: /eliminar/i })).toBeInTheDocument();
  });

  it("llama a onDelete cuando se selecciona Eliminar", async () => {
    const onDelete = vi.fn();
    renderCard(flow, { onDelete });
    const menuBtn = screen.getByRole("button", { name: /acciones para/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByRole("menuitem", { name: /eliminar/i }));
    expect(onDelete).toHaveBeenCalledWith(flow);
  });

  it("llama a onRename cuando se selecciona Renombrar", async () => {
    const onRename = vi.fn();
    renderCard(flow, { onRename });
    const menuBtn = screen.getByRole("button", { name: /acciones para/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByRole("menuitem", { name: /renombrar/i }));
    expect(onRename).toHaveBeenCalledWith(flow);
  });

  it("no navega al Builder cuando se selecciona una opción del menú", async () => {
    const onDelete = vi.fn();
    renderCard(flow, { onDelete });
    const menuBtn = screen.getByRole("button", { name: /acciones para/i });
    await userEvent.click(menuBtn);
    await userEvent.click(screen.getByRole("menuitem", { name: /eliminar/i }));
    // No debería haber navegado al Builder
    expect(screen.queryByText("Builder page")).not.toBeInTheDocument();
  });

  it("el menú se cierra al hacer clic fuera", async () => {
    renderCard();
    const menuBtn = screen.getByRole("button", { name: /acciones para/i });
    await userEvent.click(menuBtn);
    expect(screen.getByRole("menuitem", { name: /eliminar/i })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: /eliminar/i })).not.toBeInTheDocument();
  });
});
