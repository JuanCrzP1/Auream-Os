import { describe, expect, it, vi } from "vitest";
import { SimulateTurnService } from "../../domains/automations/simulation/application/SimulateTurnService.js";
import { composeSimulationSandbox } from "../../apps/api/composition/composeSimulationSandbox.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import { DisabledAiGateway } from "../../infrastructure/ai/DisabledAiGateway.js";
import { DisabledHttpRequester } from "../../infrastructure/http/DisabledHttpRequester.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";
import type { BuilderFlowNode } from "../../contracts/FlowSnapshot.js";
import type { SimulationEvent, SimulationState, SimulationTurnResponse } from "../../contracts/SimulationContracts.js";

// ---------------------------------------------------------------------------
// El laboratorio de pruebas de punta a punta, con el motor real: cada turno
// llega con el estado que guardó el navegador (nada queda en el servidor) y
// devuelve el recorrido, lo que se le habría mandado al cliente y cómo quedó.
// ---------------------------------------------------------------------------

const T = "tenant-sim";
const always = { operator: "always" as const };
const link = (from: string, to: string, fromOutput?: string) => ({ id: `${from}-${to}-${fromOutput ?? ""}`, fromNodeId: from, toNodeId: to, priority: 10, isFallback: false, condition: always, ...(fromOutput ? { fromOutput } : {}) });
const node = (id: string, type: string, config: Record<string, unknown>, content: Record<string, unknown> = {}): BuilderFlowNode => ({ id, type: type as BuilderFlowNode["type"], name: id, content, config, metadata: {} });
const end = (id: string, text: string) => node(id, "end", {}, { text });

function workspace(nodes: Record<string, BuilderFlowNode>, edges: Record<string, ReturnType<typeof link>[]>): PersistedBuilderWorkspace {
  const base = buildInitialBuilderWorkspace(T, "flujo");
  return { ...base, draft: { ...base.draft, nodes: { ...base.draft.nodes, ...nodes }, edgesBySource: edges } };
}

function setup(http = new DisabledHttpRequester()) {
  const service = new SimulateTurnService(composeSimulationSandbox({ ai: new DisabledAiGateway(), http, timezone: "America/Bogota" }));
  let state: SimulationState | null = null;
  const turn = async (ws: PersistedBuilderWorkspace, event: SimulationEvent, options = { realAi: false, realIntegrations: false }): Promise<SimulationTurnResponse> => {
    const result = await service.execute(T, ws, { draft: ws.draft, state: JSON.parse(JSON.stringify(state)), event, options });
    state = result.state;
    return result;
  };
  return { turn, say: (ws: PersistedBuilderWorkspace, text: string) => turn(ws, { type: "message", text }) };
}

const texts = (result: SimulationTurnResponse) => result.messages.filter((message) => message.kind !== "pause").map((message) => message.text);

const greeting = () =>
  workspace(
    { hola: node("hola", "message", { items: [{ id: "t", kind: "text", text: "¿Cómo te llamas, {first_name}?" }] }), ask: node("ask", "question", { targetKey: "nombre" }), fin: end("fin", "Encantado, {{context.nombre}}") },
    { start: [link("start", "hola")], hola: [link("hola", "ask")], ask: [link("ask", "fin", "respuesta")] }
  );

describe("laboratorio de pruebas", () => {
  it("saluda al cliente de prueba, espera la respuesta y sigue por «respuesta» con el dato guardado; el estado viaja con el navegador", async () => {
    const lab = setup();
    const first = await lab.turn(greeting(), { type: "start" });
    expect([first.status, texts(first)]).toEqual(["waiting_reply", ["¿Cómo te llamas, Cliente?"]]);
    expect(first.steps.map((step) => [step.nodeId, step.status])).toEqual([["start", "success"], ["hola", "success"], ["ask", "waiting_input"]]);
    expect(first.steps[2]!.notes).toContain("Espera la respuesta del cliente");

    const second = await lab.say(greeting(), "Ana");
    expect([second.status, texts(second)]).toEqual(["finished", ["Encantado, Ana"]]);
    expect(second.steps[0]).toMatchObject({ nodeId: "ask", output: { id: "respuesta", label: "Respuesta" }, notes: expect.arrayContaining(["Guardó {nombre} = Ana"]) });
    expect(second.variables).toEqual({ nombre: "Ana" });
  });

  it("si el flujo cambió donde estaba la prueba, empieza de nuevo y lo avisa", async () => {
    const lab = setup();
    await lab.turn(greeting(), { type: "start" });
    const changed = greeting();
    const { ask: _ask, ...nodes } = changed.draft.nodes;
    void _ask;
    const result = await lab.say({ ...changed, draft: { ...changed.draft, nodes, edgesBySource: { start: [link("start", "hola")] } } }, "Ana");
    expect(result.notice).toMatch(/empezó de nuevo/);
    expect(texts(result)).toEqual(["¿Cómo te llamas, Cliente?"]);
  });

  it("las etiquetas van al cliente de prueba y el Pixel no se envía a Meta (queda anotado)", async () => {
    const lab = setup();
    const ws = workspace(
      { tags: node("tags", "tags", { action: "add", tags: ["VIP"] }), pixel: node("pixel", "pixel", { connectionId: "px1", event: "lead" }) },
      { start: [link("start", "tags")], tags: [link("tags", "pixel")] }
    );
    const result = await lab.turn(ws, { type: "start" });
    expect(result.state.persona.tags).toEqual(["VIP"]);
    expect(result.steps.find((step) => step.nodeId === "tags")!.notes).toContain("Etiquetas añadidas: VIP");
    expect(result.steps.find((step) => step.nodeId === "pixel")!.notes.join(" ")).toMatch(/Lead.*no se envía a Meta/);
  });

  it("la Integración no sale salvo que se pida; con «Integraciones reales» llama de verdad", async () => {
    const send = vi.fn(async () => ({ ok: true as const, response: { status: 201, headers: {}, body: "{}" }, durationMs: 12 }));
    const lab = setup({ send } as never);
    const ws = workspace({ api: node("api", "integration", { method: "POST", url: "https://hooks.ejemplo.com/lead" }) }, { start: [link("start", "api")] });
    const simulated = await lab.turn(ws, { type: "start" });
    expect(send).not.toHaveBeenCalled();
    expect(simulated.steps[1]!.notes.join(" ")).toMatch(/Integración simulada: POST https:\/\/hooks\.ejemplo\.com\/lead/);
    const real = await lab.turn(ws, { type: "start" }, { realAi: false, realIntegrations: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(real.steps[1]!.notes.join(" ")).toMatch(/Integración real: .* 201/);
  });

  it("el Programador deja la prueba esperando; «Saltar espera» la continúa (un mensaje mientras tanto no la mueve)", async () => {
    const lab = setup();
    const ws = workspace(
      { wait: node("wait", "delay", { trigger: "interval", wait: { amount: 2, unit: "hours" } }), fin: end("fin", "Ya pasaron 2 horas") },
      { start: [link("start", "wait")], wait: [link("wait", "fin")] }
    );
    const first = await lab.turn(ws, { type: "start" });
    expect([first.status, first.wait?.reason]).toEqual(["waiting_timer", "resume"]);
    const ignored = await lab.say(ws, "¿hola?");
    expect([ignored.notice, ignored.steps]).toEqual([expect.stringMatching(/Saltar espera/), []]);
    const resumed = await lab.turn(ws, { type: "skip-wait" });
    expect([resumed.status, texts(resumed)]).toEqual(["finished", ["Ya pasaron 2 horas"]]);
  });
});

describe("laboratorio — Menú, Condicional y Distribuidor juntos", () => {
  function flow(otherTo = "otra"): PersistedBuilderWorkspace {
    return workspace(
      {
        menu: node("menu", "menu", { format: "buttons", message: "¿En qué te ayudo?", options: [{ id: "precios", title: "Precios" }, { id: "horarios", title: "Horarios" }, { id: "asesor", title: "Asesor" }] }),
        precios: end("precios", "El plan cuesta $50.000"),
        horario: node("horario", "condition", { match: "all", rules: [{ id: "r1", category: "time", operator: "after", value: "00:00", field: "" }] }),
        abierto: end("abierto", "Estamos abiertos"),
        cerrado: end("cerrado", "Estamos cerrados"),
        reparto: node("reparto", "distributor", { outputs: [{ id: "ana", label: "Ana" }, { id: "beto", label: "Beto" }] }),
        ana: end("ana", "Te atiende Ana"),
        beto: end("beto", "Te atiende Beto"),
        otra: end("otra", "No entendí tu respuesta")
      },
      {
        start: [link("start", "menu")],
        menu: [link("menu", "precios", "precios"), link("menu", "horario", "horarios"), link("menu", "reparto", "asesor"), link("menu", otherTo, "menu-other")],
        horario: [link("horario", "abierto", "true"), link("horario", "cerrado", "false")],
        reparto: [link("reparto", "ana", "ana"), link("reparto", "beto", "beto")]
      }
    );
  }

  it("cada opción lleva a su camino (por botón o por texto), con el nombre de la salida en el recorrido; el asesor se reparte por turnos", async () => {
    const lab = setup();
    const menu = await lab.turn(flow(), { type: "start" });
    expect(menu.messages[0]).toMatchObject({ kind: "menu", text: "¿En qué te ayudo?", menu: { format: "buttons", options: [{ id: "precios" }, { id: "horarios" }, { id: "asesor" }] } });
    const prices = await lab.turn(flow(), { type: "choice", optionId: "precios", title: "Precios" });
    expect([texts(prices), prices.steps[0]!.output]).toEqual([["El plan cuesta $50.000"], { id: "precios", label: "Precios" }]);

    const answers: string[] = [];
    for (const reply of ["horarios", "quiero otra cosa", "3", "Asesor", "3"]) {
      await lab.turn(flow(), { type: "start" });
      answers.push(texts(await lab.say(flow(), reply))[0]!);
    }
    expect(answers).toEqual(["Estamos abiertos", "No entendí tu respuesta", "Te atiende Ana", "Te atiende Beto", "Te atiende Ana"]);
  });

  it("«Otra respuesta» conectada al mismo Menú lo vuelve a enviar y espera; luego una opción válida sigue su camino", async () => {
    const lab = setup();
    const first = await lab.turn(flow("menu"), { type: "start" });
    const again = await lab.say(flow("menu"), "quiero otra cosa");
    expect(texts(again)).toEqual(texts(first));
    expect(texts(await lab.say(flow("menu"), "tampoco sé"))).toEqual(texts(first));
    expect(texts(await lab.say(flow("menu"), "1"))).toEqual(["El plan cuesta $50.000"]);
  });
});

describe("laboratorio — pausas entre mensajes", () => {
  it("una pausa corta viaja con su duración y «escribiendo…»; una larga deja la prueba esperando con su hora", async () => {
    const lab = setup();
    const ws = workspace(
      {
        hola: node("hola", "message", {
          items: [
            { id: "a", kind: "text", text: "Hola" },
            { id: "p", kind: "interval", amount: 3, unit: "seconds" },
            { id: "b", kind: "text", text: "¿Seguimos?" },
            { id: "q", kind: "interval", amount: 25, unit: "seconds" },
            { id: "c", kind: "text", text: "Ya pasaron 25 s" }
          ]
        })
      },
      { start: [link("start", "hola")] }
    );
    const first = await lab.turn(ws, { type: "start" });
    expect(first.messages.map((message) => [message.kind, message.text || message.delayMs])).toEqual([["text", "Hola"], ["pause", 3000], ["text", "¿Seguimos?"]]);
    expect(first.messages[1]).toMatchObject({ presence: "composing" });
    expect([first.status, first.wait?.reason, Date.parse(first.wait!.until) - Date.now()]).toEqual(["waiting_timer", "resume", expect.any(Number)]);
    expect(Date.parse(first.wait!.until) - Date.now()).toBeGreaterThan(20_000);
    expect(texts(await lab.turn(ws, { type: "skip-wait" }))).toEqual(["Ya pasaron 25 s"]);
  });
});
