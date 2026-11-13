import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConditionEditor } from "@features/automations/builder/tools/conditional/ConditionEditor";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { BusinessDatum } from "@contracts/BusinessDataContracts";

// ---------------------------------------------------------------------------
// Condicional sobre un Dato del negocio («Variable global»): se elige de la
// lista de Configuración, la regla ofrece lo de su tipo (Sí / No, número
// entre…) y dice cuánto vale hoy. Uno que no existe (un flujo de Leona) se
// sigue viendo, con el aviso de crearlo.
// ---------------------------------------------------------------------------

const datum = (key: string, label: string, type: BusinessDatum["type"], value: string): BusinessDatum => ({ id: key, key, label, type, value, description: "", createdAt: "", updatedAt: "" });
const RESOURCES: ToolResources = { labels: [], businessData: [datum("g_promo_activa", "Promo activa", "boolean", "true"), datum("g_cupos", "Cupos", "number", "12")] };

function Editor({ field = "", onConfig }: { readonly field?: string; readonly onConfig: (config: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Condicional", content: {}, config: { match: "all", rules: [{ id: "r1", category: "globalVariable", operator: "equal", field, value: "" }] } });
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

const lastRule = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls.at(-1)![0] as { rules: Array<Record<string, unknown>> }).rules[0];

describe("Condicional con un Dato del negocio", () => {
  it("sí o no: se elige de la lista, dice cuánto vale hoy y ofrece Sí / No", () => {
    const onConfig = vi.fn();
    render(<Editor onConfig={onConfig} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Dato del negocio de la regla 1" }), { target: { value: "g_promo_activa" } });
    expect(screen.getByText("Hoy vale «Sí». Se cambia en Configuración › Datos del negocio.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí" }));
    expect(lastRule(onConfig)).toMatchObject({ category: "globalVariable", field: "g_promo_activa", operator: "equal", value: "Sí" });
    expect(screen.getByText("Se cumple si Promo activa es igual a Sí.")).toBeInTheDocument();
  });

  it("número: «está entre» dos valores", () => {
    const onConfig = vi.fn();
    render(<Editor onConfig={onConfig} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Dato del negocio de la regla 1" }), { target: { value: "g_cupos" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Operador de la regla 1" }), { target: { value: "between" } });
    fireEvent.change(screen.getByLabelText("Valor de la regla 1: desde"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Valor de la regla 1: hasta"), { target: { value: "20" } });
    expect(lastRule(onConfig)).toMatchObject({ field: "g_cupos", operator: "between", value: "1\n20" });
  });

  it("uno que aún no existe se ve y avisa que hay que crearlo", () => {
    render(<Editor field="g_horario" onConfig={vi.fn()} />);
    expect(screen.getByRole("option", { name: "{g_horario} · no existe en Datos del negocio" })).toBeInTheDocument();
    expect(screen.getByText(/Créalo en Configuración › Datos del negocio con la clave \{g_horario\}/)).toBeInTheDocument();
  });
});
