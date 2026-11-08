import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiEditor } from "@features/automations/builder/tools/ai-extension/AiEditor";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { AiCredentialSummary } from "@contracts/AiContracts";
import type { AiTestRequest } from "@contracts/AiTestContracts";

// ---------------------------------------------------------------------------
// Editor de la Extensión IA: conexión de la cuenta (nunca una clave en el
// bloque), modelos reales de esa conexión y «Probar». Todo llega por props.
// ---------------------------------------------------------------------------

const GEMINI: AiCredentialSummary = { id: "g1", provider: "gemini", name: "Gemini", hint: "••••wxyz", status: "active", lastVerifiedAt: null, createdAt: "x" };

function Editor({ resources, config = {} }: { resources: ToolResources; config?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "IA", content: {}, config: { userMessage: "{last_message}", responseVariable: "ia.respuesta", ...config } });
  return (
    <>
      <AiEditor draft={draft} resources={resources} onChange={(patch: NodePatch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="config">{JSON.stringify(draft.config)}</output>
    </>
  );
}
const saved = () => JSON.parse(screen.getByTestId("config").textContent!) as Record<string, unknown>;

describe("conexión y modelo", () => {
  it("sin conexiones, conecta una desde el bloque y la elige", async () => {
    const createAiCredential = vi.fn(async () => ({ ok: true as const, value: { ...GEMINI, id: "nuevo" } }));
    render(<Editor resources={{ labels: [], aiCredentials: [], aiCredentialsStatus: "ready", createAiCredential }} />);

    await userEvent.click(screen.getByRole("radio", { name: "Google Gemini" }));
    await userEvent.type(screen.getByLabelText("Clave de API"), "AIza-clave-0123456789abcdef");
    await userEvent.click(screen.getByRole("button", { name: "Conectar" }));

    expect(createAiCredential).toHaveBeenCalledWith({ provider: "gemini", name: "Google Gemini", apiKey: "AIza-clave-0123456789abcdef" });
    expect(saved()).toMatchObject({ credentialId: "nuevo" });
    expect(JSON.stringify(saved())).not.toContain("AIza");
  });

  it("con una conexión elegida carga sus modelos y propone el recomendado", async () => {
    const listAiModels = vi.fn(async () => ({ ok: true as const, value: [{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }, { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }] }));
    render(<Editor resources={{ labels: [], aiCredentials: [GEMINI], aiCredentialsStatus: "ready", listAiModels }} config={{ credentialId: "g1" }} />);

    await waitFor(() => expect(saved()["model"]).toBe("gemini-2.5-flash"));
    expect(listAiModels).toHaveBeenCalledWith("g1");
    await userEvent.selectOptions(screen.getByLabelText("Modelo"), "gemini-2.5-pro");
    expect(saved()["model"]).toBe("gemini-2.5-pro");
  });

  it("«Otro modelo…» permite escribir el identificador", async () => {
    render(<Editor resources={{ labels: [], aiCredentials: [GEMINI], aiCredentialsStatus: "ready" }} config={{ credentialId: "g1", model: "gemini-2.5-flash" }} />);
    await userEvent.selectOptions(screen.getByLabelText("Modelo"), "__custom__");
    const field = screen.getByLabelText("Identificador del modelo");
    await userEvent.clear(field);
    await userEvent.type(field, "gemini-3-preview");
    expect(saved()["model"]).toBe("gemini-3-preview");
  });

  it("si la lista de modelos falla, ofrece los sugeridos y lo dice", async () => {
    render(<Editor resources={{ labels: [], aiCredentials: [GEMINI], aiCredentialsStatus: "ready", listAiModels: async () => ({ ok: false, message: "sin red" }) }} config={{ credentialId: "g1" }} />);
    expect(await screen.findByText(/Mostramos modelos sugeridos: sin red/)).toBeInTheDocument();
  });

  it("borra la clave que guardaban las versiones anteriores del bloque", async () => {
    render(<Editor resources={{ labels: [], aiCredentials: [GEMINI], aiCredentialsStatus: "ready" }} config={{ apiKey: "sk-viejo", provider: "gpt", credentialId: "g1", model: "gemini-2.5-flash" }} />);
    await userEvent.click(screen.getByRole("switch", { name: /Recordar la conversación/ }));
    expect(saved()).not.toHaveProperty("apiKey");
    expect(saved()).not.toHaveProperty("provider");
  });

  it("explica cuando el rol no permite usar conexiones", () => {
    render(<Editor resources={{ labels: [], aiCredentialsStatus: "forbidden" }} />);
    expect(screen.getByText(/Tu rol no permite usar las conexiones de IA/)).toBeInTheDocument();
  });
});

describe("Probar", () => {
  it("muestra la respuesta y el camino por el que seguiría", async () => {
    const testAi = vi.fn(async (_request: AiTestRequest) => ({ ok: true as const, value: { succeeded: true, reply: "Cuesta $49", output: "i1", intentKey: "precios", unparsed: false, durationMs: 812, usage: { inputTokens: 40, outputTokens: 9 }, missingVariables: [] } }));
    render(
      <Editor
        resources={{ labels: [], aiCredentials: [GEMINI], aiCredentialsStatus: "ready", testAi }}
        config={{ credentialId: "g1", model: "gemini-2.5-flash", intents: [{ id: "i1", description: "precios", key: "precios" }] }}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Probar" }));

    expect(await screen.findByText("Cuesta $49")).toBeInTheDocument();
    expect(screen.getByText("Seguiría por «precios»")).toBeInTheDocument();
    expect(screen.getByText("49 tokens")).toBeInTheDocument();
    expect(testAi.mock.calls[0]![0]).toMatchObject({ message: "Hola, ¿cuánto cuesta el plan pro?", config: { credentialId: "g1" } });
  });

  it("un fallo del proveedor se explica en palabras claras", async () => {
    const testAi = async () => ({ ok: true as const, value: { succeeded: false, reason: "quota_exceeded", message: "La cuenta del proveedor de IA no tiene saldo o cuota disponible.", reply: "", output: "failure", intentKey: null, unparsed: false, durationMs: 300, missingVariables: [] } });
    render(<Editor resources={{ labels: [], aiCredentials: [GEMINI], aiCredentialsStatus: "ready", testAi }} config={{ credentialId: "g1", model: "gemini-2.5-flash" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Probar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sin saldo en el proveedor");
    expect(alert).toHaveTextContent("El flujo seguiría por «Error».");
  });
});
