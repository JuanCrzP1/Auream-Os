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

function TagsConEstado({
  resources = RESOURCES,
  tags = [] as string[],
  action = "add"
}: {
  resources?: ToolResources;
  tags?: string[];
  action?: "add" | "remove";
}) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Etiquetas", content: {}, config: { action, tags } });
  return (
    <>
      <TagsEditor draft={draft} resources={resources} onChange={(patch: NodePatch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="tags">{JSON.stringify((draft.config as { tags: string[] }).tags)}</output>
    </>
  );
}

const elegidas = () => JSON.parse(screen.getByTestId("tags").textContent!) as string[];

describe("Etiquetas: lista del catálogo", () => {
  it("muestra todas las etiquetas de la cuenta para marcar y desmarcar", async () => {
    render(<TagsConEstado />);

    expect(screen.getAllByRole("checkbox").map((c) => c.textContent)).toEqual(["VIP", "Lead"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "VIP" }));
    expect(screen.getByRole("checkbox", { name: "VIP" })).toHaveAttribute("aria-checked", "true");
    expect(elegidas()).toEqual(["VIP"]);

    await userEvent.click(screen.getByRole("checkbox", { name: "VIP" }));
    expect(elegidas()).toEqual([]);
  });

  it("el buscador filtra la lista y Enter marca la que coincide", async () => {
    render(<TagsConEstado />);

    await userEvent.type(screen.getByLabelText("Etiquetas a agregar"), "lea");
    expect(screen.getAllByRole("checkbox").map((c) => c.textContent)).toEqual(["Lead"]);
    await userEvent.clear(screen.getByLabelText("Etiquetas a agregar"));
    await userEvent.type(screen.getByLabelText("Etiquetas a agregar"), "lead{Enter}");
    expect(elegidas()).toEqual(["Lead"]);
  });

  it("«Crear etiqueta» la guarda en el catálogo con un color y la deja marcada", async () => {
    const createLabel = vi.fn(async (input: { name: string; color: string }) => ({ ok: true as const, label: { name: input.name, color: input.color } }));
    render(<TagsConEstado resources={{ ...RESOURCES, createLabel }} />);

    await userEvent.type(screen.getByLabelText("Etiquetas a agregar"), "Recompra");
    await userEvent.click(screen.getByRole("button", { name: "Crear etiqueta «Recompra»" }));

    expect(createLabel).toHaveBeenCalledWith({ name: "Recompra", color: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    expect(createLabel.mock.calls[0]![0].color).not.toBe("#ef4444"); // no repite el color de una existente
    expect(elegidas()).toEqual(["Recompra"]);
  });

  it("si no se puede crear, lo explica y no la marca", async () => {
    const createLabel = async () => ({ ok: false as const, message: "Ya existe una etiqueta llamada «vip»." });
    render(<TagsConEstado resources={{ labels: [], createLabel }} />);

    await userEvent.type(screen.getByLabelText("Etiquetas a agregar"), "vip{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe una etiqueta llamada «vip».");
    expect(elegidas()).toEqual([]);
  });

  it("al quitar no ofrece crear: solo se quita lo que existe", async () => {
    render(<TagsConEstado action="remove" />);

    await userEvent.type(screen.getByLabelText("Etiquetas a quitar"), "Nueva");
    expect(screen.queryByRole("button", { name: /Crear etiqueta/ })).not.toBeInTheDocument();
    expect(screen.getByText("No hay etiquetas que coincidan con «Nueva».")).toBeInTheDocument();
  });

  it("una etiqueta guardada que ya no está en el catálogo se ve como pendiente", () => {
    render(<TagsConEstado tags={["Antigua"]} />);

    expect(screen.getByTitle("No está en tu catálogo: se creará al usarse")).toHaveTextContent("Antigua");
  });

  it("sin catálogo invita a crear la primera", () => {
    render(<TagsConEstado resources={{ labels: [] }} />);

    expect(screen.getByText("Aún no tienes etiquetas. Escribe un nombre para crear la primera.")).toBeInTheDocument();
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
