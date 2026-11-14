import { describe, expect, it } from "vitest";
import { SimulateTurnService } from "../../domains/automations/simulation/application/SimulateTurnService.js";
import { composeSimulationSandbox } from "../../apps/api/composition/composeSimulationSandbox.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import { DisabledAiGateway } from "../../infrastructure/ai/DisabledAiGateway.js";
import { DisabledHttpRequester } from "../../infrastructure/http/DisabledHttpRequester.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";
import type { BuilderFlowNode } from "../../contracts/FlowSnapshot.js";
import type { SimulationEvent, SimulationState, SimulationTurnResponse } from "../../contracts/SimulationContracts.js";
import { applySetField } from "../../contracts/SetFieldConfig.js";
import { validateSetField } from "../../contracts/blocks/validation/setField.js";
import { validateGoToFlow } from "../../contracts/blocks/validation/goToFlow.js";
import { validateMessageContent } from "../../contracts/blocks/validation/message.js";
import { isValidOutput } from "../../contracts/blocks/connectionRules.js";
import { listResponsePaths, readResponsePath } from "../../flow-engine/nodes/integration/responsePaths.js";
import { flowKeys } from "../../domains/contact-fields/domain/fieldUses.js";
import { renameFlowKeys } from "../../domains/contact-fields/domain/fieldMerge.js";

// ---------------------------------------------------------------------------
// Los bloques para pasar los flujos de Leona (Dilo cantando): «Guardar dato»
// (el Manipulador), «Ir a otro flujo» (la Conexión de flujo), el Mensaje con
// el enlace de un archivo en una variable y la Integración que abre la
// respuesta «empaquetada» de Kie.ai. Con el motor real del laboratorio.
// ---------------------------------------------------------------------------

const T = "tenant-sim";
const always = { operator: "always" as const };
const link = (from: string, to: string, fromOutput?: string) => ({ id: `${from}-${to}-${fromOutput ?? ""}`, fromNodeId: from, toNodeId: to, priority: 10, isFallback: false, condition: always, ...(fromOutput ? { fromOutput } : {}) });
const node = (id: string, type: string, config: Record<string, unknown>): BuilderFlowNode => ({ id, type: type as BuilderFlowNode["type"], name: id, content: {}, config, metadata: {} });
const text = (id: string, value: string) => node(id, "message", { items: [{ id: `${id}-t`, kind: "text", text: value }] });

function workspace(nodes: Record<string, BuilderFlowNode>, edges: Record<string, ReturnType<typeof link>[]>): PersistedBuilderWorkspace {
  const base = buildInitialBuilderWorkspace(T, "flujo");
  return { ...base, draft: { ...base.draft, nodes: { ...base.draft.nodes, ...nodes }, edgesBySource: edges } };
}

function lab() {
  const service = new SimulateTurnService(composeSimulationSandbox({ ai: new DisabledAiGateway(), http: new DisabledHttpRequester(), timezoneOf: async () => "America/Bogota" }));
  let state: SimulationState | null = null;
  return async (ws: PersistedBuilderWorkspace, event: SimulationEvent): Promise<SimulationTurnResponse> => {
    const result = await service.execute(T, ws, { draft: ws.draft, state: JSON.parse(JSON.stringify(state)), event, options: { realAi: false, realIntegrations: false } });
    state = result.state;
    return result;
  };
}

const sent = (result: SimulationTurnResponse) => result.messages.filter((message) => message.kind !== "pause");

describe("Guardar dato", () => {
  it("las cuentas: vacío es 0, sin decimales de más y nunca guarda basura", () => {
    expect(applySetField("add", undefined, "1")).toEqual({ ok: true, value: 1 });
    expect(applySetField("add", "2", "1")).toEqual({ ok: true, value: 3 });
    expect(applySetField("add", 0.1, "0.2")).toEqual({ ok: true, value: 0.3 });
    expect(applySetField("divide", "5500", "994")).toEqual({ ok: true, value: 5.533199 });
    expect(applySetField("multiply", "1.200", "2")).toEqual({ ok: true, value: 2400 });
    expect(applySetField("divide", "10", "0")).toEqual({ ok: false, reason: "divide_by_zero" });
    expect(applySetField("subtract", "abc", "1")).toEqual({ ok: false, reason: "not_a_number" });
    expect(applySetField("set", "lo que sea", "usada")).toEqual({ ok: true, value: "usada" });
  });

  it("pide el dato y el valor; no deja cambiar los Datos del negocio ni lo que llena Auream", () => {
    expect(validateSetField({}, { field: "", value: "x" }).reason).toMatch(/Elige el dato/);
    expect(validateSetField({}, { field: "cancion", value: " " }).reason).toMatch(/Escribe el valor/);
    expect(validateSetField({}, { field: "g_horario", value: "x" }).reason).toMatch(/no se cambia desde un flujo/);
    expect(validateSetField({}, { field: "phone", value: "x" }).reason).toMatch(/no se cambia desde un flujo/);
    expect(validateSetField({}, { field: "mi campo", value: "x" }).reason).toMatch(/solo admite/);
    expect(validateSetField({}, { field: "kie.ai.result", operation: "set", value: "{portada}" }).valid).toBe(true);
  });

  it("en un flujo: copia una variable en otro dato y lleva la cuenta de reintentos; los siguientes bloques los leen", async () => {
    const turn = lab();
    const ws = workspace(
      {
        copiar: node("copiar", "set-field", { field: "cancion_video", operation: "set", value: "{cancion_2|https://x/c2.mp3}" }),
        contar: node("contar", "set-field", { field: "reintentos", operation: "add", value: "1" }),
        otra: node("otra", "set-field", { field: "reintentos", operation: "add", value: "1" }),
        decir: text("decir", "Canción {cancion_video} · intento {reintentos}")
      },
      { start: [link("start", "copiar")], copiar: [link("copiar", "contar")], contar: [link("contar", "otra")], otra: [link("otra", "decir")] }
    );
    const result = await turn(ws, { type: "start" });
    expect(sent(result).map((message) => message.text)).toEqual(["Canción https://x/c2.mp3 · intento 2"]);
    expect(result.variables).toMatchObject({ cancion_video: "https://x/c2.mp3", reintentos: 2 });
    expect(result.steps.find((step) => step.nodeId === "contar")?.notes).toContain("Guardó {reintentos} = 1");
  });

  it("una cuenta imposible no cambia el dato y el laboratorio lo dice", async () => {
    const turn = lab();
    const ws = workspace({ dividir: node("dividir", "set-field", { field: "monto", operation: "divide", value: "0" }) }, { start: [link("start", "dividir")] });
    const result = await turn(ws, { type: "start" });
    expect(result.variables).toEqual({});
    expect(result.steps.find((step) => step.nodeId === "dividir")?.notes).toContain("No dividió entre 0 (el dato no cambió)");
  });
});

describe("Ir a otro flujo", () => {
  it("pide elegir el flujo y no tiene salidas: no se le conecta nada", () => {
    expect(validateGoToFlow({}, {}).reason).toMatch(/Elige el flujo/);
    expect(validateGoToFlow({}, { flowId: "f2", flowName: "Promoción" }).valid).toBe(true);
    expect([isValidOutput("go-to-flow", { flowId: "f2" }, null), isValidOutput("go-to-flow", { flowId: "f2" }, "success")]).toEqual([false, false]);
  });

  it("en el laboratorio el flujo termina ahí y avisa a qué flujo pasa el cliente", async () => {
    const turn = lab();
    const ws = workspace(
      { antes: text("antes", "Te paso con la promo"), saltar: node("saltar", "go-to-flow", { flowId: "11111111-1111-4111-8111-111111111111", flowName: "dilo cantando Promoción" }) },
      { start: [link("start", "antes")], antes: [link("antes", "saltar")] }
    );
    const result = await turn(ws, { type: "start" });
    expect(result.status).toBe("finished");
    expect(sent(result).map((message) => message.text)).toEqual(["Te paso con la promo"]);
    expect(result.steps.find((step) => step.nodeId === "saltar")?.notes).toContain("Aquí el cliente pasa al flujo «dilo cantando Promoción»");
    expect(result.notice).toMatch(/pasa al flujo «dilo cantando Promoción»/);
  });
});

describe("Mensaje con el enlace en una variable (como en Leona)", () => {
  it("se puede guardar con {variable} en vez de un enlace", () => {
    expect(validateMessageContent({}, { items: [{ id: "i", kind: "image", url: "{kie.ai.result}", caption: "" }] }).valid).toBe(true);
    expect(validateMessageContent({}, { items: [{ id: "i", kind: "image", url: "portada.png", caption: "" }] }).valid).toBe(false);
  });

  it("al enviar pone el enlace de la variable; si no trae un enlace, ese archivo no sale y queda anotado", async () => {
    const turn = lab();
    const ws = workspace(
      {
        guardar: node("guardar", "set-field", { field: "portada", operation: "set", value: "https://cdn.kie.ai/portada.png" }),
        enviar: node("enviar", "message", {
          items: [
            { id: "img", kind: "image", url: "{portada}", caption: "¡Tu portada!" },
            { id: "vid", kind: "video", url: "{video_listo}", caption: "" }
          ]
        })
      },
      { start: [link("start", "guardar")], guardar: [link("guardar", "enviar")] }
    );
    const result = await turn(ws, { type: "start" });
    const media = sent(result).filter((message) => message.kind === "media");
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({ media: { type: "image", url: "https://cdn.kie.ai/portada.png" }, text: "¡Tu portada!" });
  });
});

describe("Integración: la respuesta «empaquetada» de Kie.ai", () => {
  const response = { status: 200, headers: {}, body: "" };
  const kie = { code: 200, data: { taskId: "t1", state: "success", resultJson: JSON.stringify({ resultUrls: ["https://cdn.kie.ai/portada.png"] }) } };

  it("lee dentro de un JSON escrito como texto y lo ofrece al configurar", () => {
    expect(readResponsePath(response, kie, "data.resultJson.resultUrls[0]")).toEqual({ found: true, value: "https://cdn.kie.ai/portada.png" });
    expect(readResponsePath(response, kie, "data.state")).toEqual({ found: true, value: "success" });
    expect(readResponsePath(response, { data: { note: "hola" } }, "data.note.otra")).toEqual({ found: false });
    expect(listResponsePaths(kie).map((path) => path.path)).toEqual(expect.arrayContaining(["data.resultJson", "data.resultJson.resultUrls[0]"]));
  });
});

describe("Campos del cliente", () => {
  const draft = workspace({ g: node("g", "set-field", { field: "cancion_video", operation: "set", value: "{cancion_2}" }) }, {}).draft;

  it("Guardar dato cuenta como quien llena el campo, y al unir campos se renombra", () => {
    const uses = flowKeys(draft).uses.filter((use) => use.use.blockId === "g").map((use) => [use.key, use.use.role]);
    expect(uses).toEqual(expect.arrayContaining([["cancion_video", "fills"], ["cancion_2", "reads"]]));
    const renamed = renameFlowKeys(draft, new Map([["cancion_video", "cancion_elegida"]]));
    expect(renamed.draft.nodes["g"]!.config).toMatchObject({ field: "cancion_elegida" });
  });
});
