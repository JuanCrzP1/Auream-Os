import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowLab } from "../../src/features/automations/builder/lab/FlowLab";
import { useFlowLab } from "../../src/features/automations/builder/lab/useFlowLab";
import { canvasTrail } from "../../src/features/automations/builder/lab/labModel";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { SimulationTurnResponse } from "@contracts/SimulationContracts";

// ---------------------------------------------------------------------------
// El laboratorio de pruebas del editor: manda lo que está en el lienzo y el
// estado de la prueba en cada turno (el servidor no guarda nada), muestra la
// conversación, el recorrido bloque a bloque y los datos, deja tocar las
// opciones de un menú y saltar una espera.
// ---------------------------------------------------------------------------

const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;
const DRAFT = { flow: { id: "f1", key: "f1", name: "Demo" }, version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "start" }, nodes: {}, edgesBySource: {} } as unknown as BuilderFlowSnapshot;
const persona = { name: "Cliente de prueba", phone: "573000000000", email: "", tags: [] as string[], fields: {} };
const session = (currentNodeId: string, status: string) => ({ id: "s", tenantId: "t", flowId: "f1", flowVersionId: "v1", channel: "builder-simulator", conversationKey: "c", userKey: "u", currentNodeId, status, revision: 2, context: {}, createdAt: "", updatedAt: "" });

const MENU: SimulationTurnResponse = {
  state: { session: session("menu", "waiting_input") as never, persona, wait: null, counters: {} },
  status: "waiting_reply",
  steps: [
    { nodeId: "start", nodeName: "Inicio", nodeType: "start", status: "success", output: null, notes: [] },
    { nodeId: "menu", nodeName: "¿Qué buscas?", nodeType: "menu", status: "waiting_input", output: null, notes: ["Espera que el cliente elija una opción"] }
  ],
  messages: [{ nodeId: "menu", kind: "menu", text: "¿En qué te ayudo?", menu: { format: "buttons", options: [{ id: "precios", title: "Precios" }, { id: "asesor", title: "Asesor" }] } }],
  wait: null,
  variables: {},
  notice: null
};
const FAR = new Date(Date.now() + 2 * 3_600_000).toISOString();
const WAITING: SimulationTurnResponse = {
  state: { session: session("wait", "delayed") as never, persona: { ...persona, tags: ["quiere-asesor"] }, wait: { reason: "resume", nodeId: "wait", revision: 4, until: FAR }, counters: {} },
  status: "waiting_timer",
  steps: [
    { nodeId: "menu", nodeName: "¿Qué buscas?", nodeType: "menu", status: "success", output: { id: "asesor", label: "Asesor" }, notes: [] },
    { nodeId: "tags", nodeName: "Quiere asesor", nodeType: "tags", status: "success", output: null, notes: ["Etiquetas añadidas: quiere-asesor"] }
  ],
  messages: [],
  wait: { reason: "resume", nodeId: "wait", revision: 4, until: FAR },
  variables: { nombre: "Laura" },
  notice: null
};
const DONE: SimulationTurnResponse = { ...WAITING, state: { ...WAITING.state, session: session("fin", "completed") as never, wait: null }, status: "finished", steps: [], messages: [{ nodeId: "fin", kind: "text", text: "Ya te contacta un asesor" }], wait: null };

function setup(responses: SimulationTurnResponse[]) {
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal("fetch", vi.fn(async (_input: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return reply(responses.shift());
  }));
  const focus = vi.fn();
  function Harness() {
    const lab = useFlowLab("f1", () => DRAFT);
    return <FlowLab lab={lab} blockName={(id) => ({ menu: "¿Qué buscas?", fin: "Seguimiento", wait: "Esperar 2 h", pausa: "Bienvenida" })[id] ?? id} onFocusBlock={focus} onClose={() => undefined} />;
  }
  render(<Harness />);
  return { bodies, focus };
}

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("laboratorio de pruebas", () => {
  it("inicia con lo del lienzo, deja tocar una opción del menú, salta la espera y termina", async () => {
    const lab = setup([MENU, WAITING, DONE]);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar prueba" }));
    expect(lab.bodies[0]).toMatchObject({ draft: DRAFT, event: { type: "start" }, options: { realAi: true, realIntegrations: false }, state: { session: null } });
    expect(await screen.findByText("¿En qué te ayudo?")).toBeInTheDocument();
    expect(screen.getByText("Esperando respuesta")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Asesor" }));
    expect(lab.bodies[1]).toMatchObject({ event: { type: "choice", optionId: "asesor", title: "Asesor" }, state: { session: { currentNodeId: "menu" } } });
    expect(await screen.findByText(/«Esperar 2 h» continúa/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Adelantar espera" }));
    expect(lab.bodies[2]).toMatchObject({ event: { type: "skip-wait" }, state: { wait: { nodeId: "wait" }, persona: { tags: ["quiere-asesor"] } } });
    expect(await screen.findByText(/Fin del flujo/)).toBeInTheDocument();
  });

  it("como en WhatsApp: respeta las pausas con «escribiendo…» y una espera corta sigue sola al terminar", async () => {
    const soon = new Date(Date.now() + 1_200).toISOString();
    const short: SimulationTurnResponse = {
      ...WAITING,
      state: { ...WAITING.state, wait: { reason: "resume", nodeId: "pausa", revision: 2, until: soon } },
      steps: [],
      messages: [
        { nodeId: "pausa", kind: "text", text: "Hola" },
        { nodeId: "pausa", kind: "pause", text: "", delayMs: 600, presence: "composing" },
        { nodeId: "pausa", kind: "text", text: "¿Seguimos?" }
      ],
      wait: { reason: "resume", nodeId: "pausa", revision: 2, until: soon }
    };
    const lab = setup([short, DONE]);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar prueba" }));
    expect(await screen.findByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("escribiendo…")).toBeInTheDocument();
    expect(await screen.findByText("¿Seguimos?", {}, { timeout: 2_000 })).toBeInTheDocument();
    expect(await screen.findByText(/«Bienvenida» continúa en \d s/)).toBeInTheDocument();
    expect(await screen.findByText("Ya te contacta un asesor", {}, { timeout: 4_000 })).toBeInTheDocument();
    expect(lab.bodies[1]).toMatchObject({ event: { type: "skip-wait" }, state: { wait: { nodeId: "pausa" } } });
  });

  it("el recorrido muestra cada bloque con su salida y lo que hizo; un toque lleva al bloque; Datos muestra el cliente y las variables", async () => {
    const lab = setup([MENU, WAITING]);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar prueba" }));
    await screen.findByText("¿En qué te ayudo?");
    await userEvent.type(screen.getByRole("textbox", { name: "Mensaje del cliente de prueba" }), "asesor{Enter}");
    await screen.findByText(/«Esperar 2 h» continúa/);

    await userEvent.click(screen.getByRole("tab", { name: /Recorrido · 4/ }));
    expect(screen.getByText("Salió por «Asesor»")).toBeInTheDocument();
    expect(screen.getByText("Etiquetas añadidas: quiere-asesor")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Quiere asesor/ }));
    expect(lab.focus).toHaveBeenCalledWith("tags");

    await userEvent.click(screen.getByRole("tab", { name: "Datos" }));
    expect(screen.getByText("quiere-asesor")).toBeInTheDocument();
    expect(screen.getByText("Laura")).toBeInTheDocument();
  });

  it("los ajustes se recuerdan y viajan en la siguiente prueba", async () => {
    const lab = setup([MENU]);
    await userEvent.click(screen.getByRole("button", { name: "Ajustes de la prueba" }));
    await userEvent.click(screen.getByRole("switch", { name: /Integraciones reales/ }));
    await userEvent.click(screen.getByRole("button", { name: "Iniciar prueba" }));
    expect(lab.bodies[0]).toMatchObject({ options: { realIntegrations: true } });
    expect(JSON.parse(window.localStorage.getItem("auream.lab.options")!)).toEqual({ realAi: true, realIntegrations: true });
  });
});

describe("lo que se ilumina en el lienzo", () => {
  it("los bloques del último turno y, si espera, dónde espera", () => {
    const trail = canvasTrail([{ id: 1, event: { type: "start" }, response: MENU }]);
    expect([[...trail.visited], trail.current]).toEqual([["start", "menu"], "menu"]);
    expect(canvasTrail([{ id: 2, event: { type: "skip-wait" }, response: DONE }]).current).toBeNull();
  });
});
