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

describe("simulación — Menú, Condicional y Distribuidor juntos", () => {
  const always = { operator: "always" as const };
  const link = (from: string, to: string, fromOutput?: string) => ({
    id: `${from}-${to}`, fromNodeId: from, toNodeId: to, priority: 10, isFallback: false, condition: always,
    ...(fromOutput ? { fromOutput } : {})
  });
  const end = (id: string, text: string) => ({ id, type: "end" as const, name: id, content: { text }, config: {}, metadata: {} });

  function flow(): PersistedBuilderWorkspace {
    const base = buildInitialBuilderWorkspace("tenant-sim", "soporte");
    return {
      ...base,
      draft: {
        ...base.draft,
        nodes: {
          ...base.draft.nodes,
          menu: { id: "menu", type: "menu", name: "Menú", content: {}, metadata: {}, config: {
            format: "buttons", message: "¿En qué te ayudo?",
            options: [{ id: "precios", title: "Precios" }, { id: "horarios", title: "Horarios" }, { id: "asesor", title: "Asesor" }]
          } },
          precios: end("precios", "El plan cuesta $50.000"),
          horario: { id: "horario", type: "condition", name: "¿Abierto?", content: {}, metadata: {}, config: {
            match: "all", rules: [{ id: "r1", category: "time", operator: "after", value: "00:00", field: "" }]
          } },
          abierto: end("abierto", "Estamos abiertos"),
          cerrado: end("cerrado", "Estamos cerrados"),
          reparto: { id: "reparto", type: "distributor", name: "Reparto", content: {}, metadata: {}, config: {
            outputs: [{ id: "ana", label: "Ana" }, { id: "beto", label: "Beto" }]
          } },
          ana: end("ana", "Te atiende Ana"),
          beto: end("beto", "Te atiende Beto"),
          otra: end("otra", "No entendí tu respuesta")
        },
        edgesBySource: {
          start: [link("start", "menu")],
          menu: [link("menu", "precios", "precios"), link("menu", "horario", "horarios"), link("menu", "reparto", "asesor"), link("menu", "otra", "menu-other")],
          horario: [link("horario", "abierto", "true"), link("horario", "cerrado", "false")],
          reparto: [link("reparto", "ana", "ana"), link("reparto", "beto", "beto")]
        }
      }
    };
  }

  /** «Otra respuesta» vuelve al mismo Menú (como en Leona). */
  function menuLoopFlow(): PersistedBuilderWorkspace {
    const base = flow();
    const menuEdges = base.draft.edgesBySource["menu"]!.map((edge) => (edge.fromOutput === "menu-other" ? { ...edge, toNodeId: "menu" } : edge));
    return { ...base, draft: { ...base.draft, edgesBySource: { ...base.draft.edgesBySource, menu: menuEdges } } };
  }

  async function chat(service: SimulateDraftService, conversation: string, ...messages: string[]) {
    return chatWith(service, flow, conversation, ...messages);
  }

  async function chatWith(service: SimulateDraftService, build: () => PersistedBuilderWorkspace, conversation: string, ...messages: string[]) {
    const replies: string[][] = [];
    for (const message of messages) {
      const result = await service.simulate(build(), { message, conversationKey: conversation, userKey: conversation });
      replies.push(result.outputMessages.map((m) => m.content));
    }
    return replies;
  }

  it("cada opción del menú lleva a su camino, y el asesor se reparte por turnos", async () => {
    const service = new SimulateDraftService(new BuilderSimulationRuntimeFactory(composeNodeRuntime(), "America/Bogota"));

    expect((await chat(service, "c1", "hola", "1"))[1]).toEqual(["El plan cuesta $50.000"]);
    expect((await chat(service, "c2", "hola", "horarios"))[1]).toEqual(["Estamos abiertos"]);
    expect((await chat(service, "c3", "hola", "quiero otra cosa"))[1]).toEqual(["No entendí tu respuesta"]);
    expect((await chat(service, "c4", "hola", "3"))[1]).toEqual(["Te atiende Ana"]);
    expect((await chat(service, "c5", "hola", "Asesor"))[1]).toEqual(["Te atiende Beto"]);
    expect((await chat(service, "c6", "hola", "3"))[1]).toEqual(["Te atiende Ana"]);
  });

  it("«Otra respuesta» conectada al mismo Menú lo vuelve a enviar y espera; luego una opción válida sigue su camino", async () => {
    const service = new SimulateDraftService(new BuilderSimulationRuntimeFactory(composeNodeRuntime(), "America/Bogota"));
    const replies = await chatWith(service, menuLoopFlow, "loop", "hola", "quiero otra cosa", "tampoco sé", "1");

    const menuText = replies[0]!.join("\n");
    expect(menuText).toContain("¿En qué te ayudo?");
    // Cada respuesta que no es opción vuelve a mostrar el menú, una sola vez (sin dar vueltas).
    expect(replies[1]).toEqual(replies[0]);
    expect(replies[2]).toEqual(replies[0]);
    expect(replies[3]).toEqual(["El plan cuesta $50.000"]);
  });
});
