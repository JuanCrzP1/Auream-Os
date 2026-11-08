import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntegrationEditor } from "@features/automations/builder/tools/integration/IntegrationEditor";
import { suggestFieldName } from "@features/automations/builder/tools/integration/suggestFieldName";
import { validateIntegration, INVALID_FIELD_MESSAGE } from "@features/automations/builder/tools/integration/validateIntegration";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { IntegrationTestOutcome, ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { IntegrationTestRequest, IntegrationTestResult } from "@contracts/IntegrationTestContracts";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// «Probar» en el editor de Integración: prueba lo que hay en el editor, pide
// valores para las variables propias, muestra la respuesta y deja guardar un
// dato con un clic. La capacidad llega por props: el editor no llama a la API.
// ---------------------------------------------------------------------------

const RESULT: IntegrationTestResult = {
  succeeded: true,
  status: 201,
  durationMs: 84,
  contentType: "application/json; charset=utf-8",
  bodyPreview: '{"lead":{"id":"L-9","stage":"nuevo"}}',
  bodyTruncated: false,
  paths: [
    { path: "lead.id", preview: "L-9" },
    { path: "lead.stage", preview: "nuevo" }
  ],
  mapped: {},
  missingPaths: [],
  missingVariables: []
};

const CONFIG = {
  method: "POST",
  url: "https://api.crm.test/leads?ciudad={ciudad}",
  headers: [],
  body: '{"nombre":"{full_name}"}',
  responseMappings: []
};

function Editor({ test }: { readonly test?: (request: IntegrationTestRequest) => Promise<IntegrationTestOutcome> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "CRM", content: {}, config: CONFIG });
  const resources: ToolResources = { labels: [], ...(test ? { testIntegration: test } : {}) };
  return (
    <>
      <IntegrationEditor draft={draft} resources={resources} onChange={(patch: NodePatch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="mappings">{JSON.stringify((draft.config as { responseMappings: unknown[] }).responseMappings)}</output>
    </>
  );
}

describe("Probar la integración", () => {
  it("envía la configuración del editor con los valores de prueba de las variables propias", async () => {
    const test = vi.fn(async () => ({ ok: true as const, result: RESULT }));
    render(<Editor test={test} />);

    await userEvent.type(screen.getByLabelText("Valor de prueba para ciudad"), "Cali");
    await userEvent.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(test).toHaveBeenCalledWith({ config: CONFIG, variables: { ciudad: "Cali" } });
    expect(await screen.findByText("201")).toBeInTheDocument();
    expect(screen.getByText(/seguirá por «Éxito»/)).toBeInTheDocument();
    expect(screen.getByText("84 ms")).toBeInTheDocument();
  });

  it("«Guardar» un dato de la respuesta lo añade al mapeo con un nombre válido", async () => {
    render(<Editor test={async () => ({ ok: true, result: RESULT })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar prueba" }));
    await userEvent.click(await screen.findByRole("button", { name: "Guardar lead.id" }));

    expect(JSON.parse(screen.getByTestId("mappings").textContent!)).toEqual([expect.objectContaining({ path: "lead.id", field: "lead_id" })]);
    const fila = screen.getByText("lead.id", { selector: "code" }).closest("li")!;
    expect(within(fila).getByText("→ lead_id")).toBeInTheDocument();
  });

  it("un error del servicio se explica y dice por dónde seguirá el flujo", async () => {
    render(<Editor test={async () => ({ ok: true, result: { ...RESULT, succeeded: false, status: 401, reason: "http_error", message: "El servicio respondió 401.", paths: [] } })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(await screen.findByText(/El servicio respondió 401\. · el flujo seguirá por «Error»/)).toBeInTheDocument();
  });

  it("un fallo de la plataforma (p. ej. límite de pruebas) se muestra como aviso", async () => {
    render(<Editor test={async () => ({ ok: false, message: "Demasiadas pruebas seguidas." })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar prueba" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiadas pruebas seguidas.");
  });

  it("sin la capacidad (fuera del builder) no ofrece el botón", () => {
    render(<Editor />);
    expect(screen.queryByRole("button", { name: "Enviar prueba" })).not.toBeInTheDocument();
  });
});

describe("suggestFieldName", () => {
  it.each([
    ["lead.id", [], "lead_id"],
    ["data.items[0].sku", [], "sku"],
    ["body.cliente.teléfono", [], "telefono"],
    ["data.0", [], "dato_0"],
    ["lead.id", ["lead_id"], "lead_id_2"]
  ])("%s → %s", (path, taken, expected) => {
    expect(suggestFieldName(path, taken)).toBe(expected);
  });
});

describe("validateIntegration", () => {
  it("un nombre de campo con espacios no es válido (no se podría guardar)", () => {
    const result = validateIntegration({}, { ...CONFIG, responseMappings: [{ id: "m", path: "lead.id", field: "id crm" }] });
    expect(result).toEqual({ valid: false, reason: INVALID_FIELD_MESSAGE });
  });
});
