import { describe, expect, it } from "vitest";
import { SimulateDraftService } from "../../domains/automations/builder/application/SimulateDraftService.js";
import { BuilderSimulationRuntimeFactory } from "../../apps/api/composition/BuilderSimulationRuntimeFactory.js";
import { composeNodeRuntime } from "../../apps/api/composition/composeNodeRuntime.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";

// ---------------------------------------------------------------------------
// La cadena real de la API (SimulateDraftService → orquestador → loop →
// bloques), asíncrona de punta a punta (C5) y enrutando por salida (C14).
// ---------------------------------------------------------------------------

function workspace(): PersistedBuilderWorkspace {
  const base = buildInitialBuilderWorkspace("tenant-sim", "flujo");
  const always = { operator: "always" as const };
  return {
    ...base,
    draft: {
      ...base.draft,
      nodes: {
        ...base.draft.nodes,
        hola: { id: "hola", type: "message", name: "Hola", content: {}, config: { items: [{ id: "t", kind: "text", text: "¿Cómo te llamas?" }] }, metadata: {} },
        ask: { id: "ask", type: "question", name: "Nombre", content: {}, config: { targetKey: "nombre" }, metadata: {} },
        fin: { id: "fin", type: "end", name: "Fin", content: { text: "Encantado, {{context.nombre}}" }, config: {}, metadata: {} }
      },
      edgesBySource: {
        start: [{ id: "e1", fromNodeId: "start", toNodeId: "hola", priority: 10, isFallback: false, condition: always }],
        hola: [{ id: "e2", fromNodeId: "hola", toNodeId: "ask", priority: 10, isFallback: false, condition: always }],
        ask: [{ id: "e3", fromNodeId: "ask", toNodeId: "fin", fromOutput: "respuesta", priority: 10, isFallback: false, condition: always }]
      }
    }
  };
}

describe("simulación de punta a punta", () => {
  it("saluda, espera la respuesta y sale por «respuesta» con el dato guardado", async () => {
    const service = new SimulateDraftService(new BuilderSimulationRuntimeFactory(composeNodeRuntime()));
    const ws = workspace();
    const request = (message: string) => ({ message, conversationKey: "c1", userKey: "u1" });

    const first = await service.simulate(ws, request("hola"));
    expect(first.executionStatus).toBe("waiting_input");
    expect(first.outputMessages.map((m) => m.content)).toEqual(["¿Cómo te llamas?"]);

    const second = await service.simulate(ws, request("Ana"));
    expect(second.executionStatus).toBe("completed");
    expect(second.outputMessages.map((m) => m.content)).toEqual(["Encantado, Ana"]);
  });
});
