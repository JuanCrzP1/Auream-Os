import { describe, it, expect, vi } from "vitest";
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
  tags: ["soporte", "ventas"]
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

  it("renders status label", () => {
    renderCard();
    expect(screen.getByText("Activo")).toBeInTheDocument();
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

  it("navigates to builder on card click", async () => {
    renderCard();
    // Hacer clic en el nombre del flow (dentro del card, fuera del menú)
    await userEvent.click(screen.getByText("Mi flujo de prueba"));
    expect(screen.getByText("Builder page")).toBeInTheDocument();
  });

  it("shows paused status", () => {
    renderCard({ ...flow, status: "paused" });
    expect(screen.getByText("Pausado")).toBeInTheDocument();
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
