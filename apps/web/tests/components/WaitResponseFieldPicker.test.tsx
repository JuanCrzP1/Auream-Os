import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { WaitResponseEditor } from "@features/automations/builder/tools/wait-response/WaitResponseEditor";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { WAIT_RESPONSE_DEFAULT_CONFIG } from "@contracts/WaitResponseConfig";

// ---------------------------------------------------------------------------
// Esperar respuesta con los Campos del cliente: se elige el campo de una
// lista (con tipo y qué tan lleno está), se crea uno ahí mismo, y con un campo
// con tipo se decide qué hacer si la respuesta no encaja.
// ---------------------------------------------------------------------------

const field = (key: string, label: string, type: ContactFieldSummary["type"], options: string[] = []): ContactFieldSummary =>
  ({ id: key, key, label, type, options, createdAt: "", updatedAt: "", filled: 64, uses: [] });

const resources = (createContactField = vi.fn()): ToolResources => ({
  labels: [],
  contactFields: { fields: [field("ciudad", "Ciudad", "list", ["Medellín", "Bogotá", "Cali"]), field("nota", "Nota", "text")], totalContacts: 100, canManage: true, status: "ready" },
  createContactField
});

function pintar(config: Record<string, unknown> = {}, res = resources()) {
  const onChange = vi.fn<(patch: NodePatch) => void>();
  render(<WaitResponseEditor draft={{ name: "Esperar respuesta", content: {}, config: { ...WAIT_RESPONSE_DEFAULT_CONFIG, ...config } }} onChange={onChange} resources={res} />);
  return onChange;
}

describe("Esperar respuesta: guardar en un Campo del cliente", () => {
  it("se elige de la lista, con su tipo y qué tan lleno está; buscar filtra", () => {
    const onChange = pintar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar en" }));
    const list = screen.getByRole("listbox", { name: "Campos del cliente" });
    expect(within(list).getByRole("option", { name: /Ciudad/ })).toHaveTextContent("Lista · 3");
    expect(within(list).getByRole("option", { name: /Ciudad/ })).toHaveTextContent("64 %");
    fireEvent.change(screen.getByLabelText("Buscar o crear un campo"), { target: { value: "nota" } });
    expect(within(list).queryByRole("option", { name: /Ciudad/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar o crear un campo"), { target: { value: "ciu" } });
    fireEvent.click(within(list).getByRole("option", { name: /Ciudad/ }));
    expect(onChange).toHaveBeenLastCalledWith({ config: expect.objectContaining({ targetKey: "ciudad" }) });
  });

  it("con un campo de lista ofrece «preguntar de nuevo» con el mensaje de ejemplo", () => {
    const onChange = pintar({ targetKey: "ciudad" });
    expect(screen.getByRole("button", { name: "Guardar en" })).toHaveTextContent("Ciudad");
    expect(screen.getByRole("group", { name: "Si responde algo que no está en la lista" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Preguntar de nuevo/ }));
    expect(onChange).toHaveBeenLastCalledWith({ config: expect.objectContaining({ targetKey: "ciudad", onMismatch: "retry" }) });
  });

  it("con «preguntar de nuevo» se puede escribir el mensaje; un campo de texto no lo ofrece", () => {
    pintar({ targetKey: "ciudad", onMismatch: "retry" });
    expect(screen.getByLabelText("Mensaje al preguntar de nuevo")).toHaveAttribute("placeholder", "Elige una de estas: Medellín, Bogotá o Cali.");
  });

  it("un campo de texto no ofrece «preguntar de nuevo»; «No guardar» lo quita y se lleva la opción", () => {
    const onChange = pintar({ targetKey: "nota" });
    expect(screen.queryByRole("group", { name: /Si responde/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar en" }));
    fireEvent.click(screen.getByRole("button", { name: "No guardar" }));
    expect(onChange.mock.calls.at(-1)![0].config).not.toHaveProperty("targetKey");
  });

  it("crear un campo ahí mismo lo deja elegido", async () => {
    const create = vi.fn(async () => ({ ok: true as const, value: { ...field("producto", "Producto", "text") } }));
    const onChange = pintar({}, resources(create));
    fireEvent.click(screen.getByRole("button", { name: "Guardar en" }));
    fireEvent.change(screen.getByLabelText("Buscar o crear un campo"), { target: { value: "Producto" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Crear el campo «Producto»" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo campo" });
    expect(within(dialog).getByRole("textbox", { name: /Nombre/ })).toHaveValue("Producto");
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear campo" }));
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ config: expect.objectContaining({ targetKey: "producto" }) }));
    expect(create).toHaveBeenCalledWith({ label: "Producto", type: "text" });
  });
});
