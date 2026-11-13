import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ConditionEditor } from "@features/automations/builder/tools/conditional/ConditionEditor";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";

// ---------------------------------------------------------------------------
// Condicional sobre un Campo del cliente: se elige el campo y la regla ofrece
// lo de su tipo (lista: las opciones como botones; sí o no: Sí/No; número:
// «está entre»; fecha: «es hoy»…), y abajo la regla en palabras.
// ---------------------------------------------------------------------------

const field = (key: string, label: string, type: ContactFieldSummary["type"], options: string[] = []): ContactFieldSummary =>
  ({ id: key, key, label, type, options, createdAt: "", updatedAt: "", filled: 10, uses: [] });

const RESOURCES: ToolResources = {
  labels: [],
  contactFields: {
    fields: [field("ciudad", "Ciudad", "list", ["Medellín", "Bogotá", "Cali"]), field("ya_compro", "Ya compró", "boolean"), field("presupuesto", "Presupuesto", "number"), field("cumple", "Cumpleaños", "date")],
    totalContacts: 20,
    canManage: false,
    status: "ready"
  }
};

function Editor({ onConfig }: { readonly onConfig: (config: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Condicional", content: {}, config: { match: "all", rules: [{ id: "r1", category: "customField", operator: "equal", field: "", value: "" }] } });
  return (
    <ConditionEditor
      draft={draft}
      resources={RESOURCES}
      onChange={(patch) => {
        setDraft((current) => ({ ...current, ...patch }));
        if (patch.config) onConfig(patch.config as Record<string, unknown>);
      }}
    />
  );
}

const choose = (name: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name: "Campo" }));
  fireEvent.click(within(screen.getByRole("listbox", { name: "Campos del cliente" })).getByRole("option", { name }));
};
const lastRule = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls.at(-1)![0] as { rules: Array<Record<string, unknown>> }).rules[0];

describe("Condicional con un Campo del cliente", () => {
  it("lista: «es una de» con las opciones como botones, y la regla en palabras", () => {
    const onConfig = vi.fn();
    render(<Editor onConfig={onConfig} />);
    choose(/Ciudad/);
    expect(lastRule(onConfig)).toMatchObject({ field: "ciudad", operator: "is_one_of", value: "" });
    const options = screen.getByRole("group", { name: "Valor de la regla 1" });
    fireEvent.click(within(options).getByRole("button", { name: "Medellín" }));
    fireEvent.click(within(options).getByRole("button", { name: "Bogotá" }));
    expect(lastRule(onConfig)).toMatchObject({ value: "Medellín\nBogotá" });
    expect(within(options).getByRole("button", { name: "Medellín" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Se cumple si Ciudad es una de Medellín o Bogotá.")).toBeInTheDocument();
  });

  it("sí o no: Sí / No; número: «está entre» con dos valores", () => {
    const onConfig = vi.fn();
    render(<Editor onConfig={onConfig} />);
    choose(/Ya compró/);
    fireEvent.click(within(screen.getByRole("group", { name: "Valor de la regla 1" })).getByRole("button", { name: "Sí" }));
    expect(lastRule(onConfig)).toMatchObject({ field: "ya_compro", operator: "equal", value: "Sí" });

    choose(/Presupuesto/);
    fireEvent.change(screen.getByRole("combobox", { name: "Operador de la regla 1" }), { target: { value: "between" } });
    fireEvent.change(screen.getByLabelText("Valor de la regla 1: desde"), { target: { value: "500.000" } });
    fireEvent.change(screen.getByLabelText("Valor de la regla 1: hasta"), { target: { value: "2.000.000" } });
    expect(lastRule(onConfig)).toMatchObject({ field: "presupuesto", operator: "between", value: "500.000\n2.000.000" });
    expect(screen.getByText("Se cumple si Presupuesto está entre 500.000 y 2.000.000.")).toBeInTheDocument();
  });

  it("fecha: empieza en «es hoy (día y mes)», que no pide valor", () => {
    const onConfig = vi.fn();
    render(<Editor onConfig={onConfig} />);
    choose(/Cumpleaños/);
    expect(lastRule(onConfig)).toMatchObject({ field: "cumple", operator: "anniversary_today" });
    expect(screen.queryByLabelText("Valor de la regla 1")).not.toBeInTheDocument();
    expect(screen.getByText("Se cumple si Cumpleaños es hoy (día y mes).")).toBeInTheDocument();
  });
});
