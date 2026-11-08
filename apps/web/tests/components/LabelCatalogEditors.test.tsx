import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagsEditor } from "@features/automations/builder/tools/tags/TagsEditor";
import { ConditionEditor } from "@features/automations/builder/tools/conditional/ConditionEditor";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// Los editores que usan etiquetas OFRECEN el catálogo de la cuenta (llega por
// props) sin obligar a usarlo: una etiqueta nueva se crea al ejecutarse.
// ---------------------------------------------------------------------------

const RESOURCES: ToolResources = {
  labels: [
    { name: "VIP", color: "#ef4444" },
    { name: "Lead", color: "#3b82f6" }
  ]
};

function TagsConEstado({ resources = RESOURCES, tags = [] as string[] }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Etiquetas", content: {}, config: { action: "add", tags } });
  return (
    <>
      <TagsEditor draft={draft} resources={resources} onChange={(patch: NodePatch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="tags">{JSON.stringify((draft.config as { tags: string[] }).tags)}</output>
    </>
  );
}

describe("Etiquetas con el catálogo", () => {
  it("ofrece las etiquetas de la cuenta y un clic las agrega", async () => {
    render(<TagsConEstado />);
    const sugerencias = screen.getByRole("group", { name: /sugerencias/i });

    await userEvent.click(screen.getByRole("button", { name: "VIP" }));

    expect(screen.getByTestId("tags")).toHaveTextContent('["VIP"]');
    expect(sugerencias).not.toHaveTextContent("VIP");
  });

  it("escribir un nombre conocido usa su escritura del catálogo", async () => {
    render(<TagsConEstado />);

    await userEvent.type(screen.getByLabelText("Etiquetas a agregar"), "lead{Enter}");

    expect(screen.getByTestId("tags")).toHaveTextContent('["Lead"]');
  });

  it("avisa de las que no existen: se crearán al usarse", async () => {
    render(<TagsConEstado />);

    await userEvent.type(screen.getByLabelText("Etiquetas a agregar"), "Nuevo cliente{Enter}");

    expect(screen.getByText(/se crearán en tu catálogo al usarse: Nuevo cliente/i)).toBeInTheDocument();
  });

  it("sin catálogo funciona como antes, sin sugerencias", () => {
    render(<TagsConEstado resources={{ labels: [] }} />);

    expect(screen.queryByRole("group", { name: /sugerencias/i })).not.toBeInTheDocument();
  });
});

describe("Condicional con el catálogo", () => {
  it("la regla de etiqueta sugiere las de la cuenta", () => {
    const draft: ToolDraft = {
      name: "Condicional",
      content: {},
      config: { match: "all", rules: [{ id: "r1", category: "tag", field: "", operator: "equal", value: "" }] }
    };
    const { container } = render(<ConditionEditor draft={draft} resources={RESOURCES} onChange={vi.fn()} />);

    const campo = screen.getByLabelText("Valor de la regla 1");
    const lista = container.querySelector(`datalist#${CSS.escape(campo.getAttribute("list") ?? "")}`);
    expect([...(lista?.querySelectorAll("option") ?? [])].map((o) => o.getAttribute("value"))).toEqual(["VIP", "Lead"]);
  });
});
