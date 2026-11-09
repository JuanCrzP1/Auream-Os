import { describe, expect, it } from "vitest";
import { matchMenuReply, renderMenuText } from "../../flow-engine/nodes/menu/matchMenuReply.js";
import { MenuNodeHandler } from "../../flow-engine/nodes/menu/MenuNodeHandler.js";
import { DistributorNodeHandler } from "../../flow-engine/nodes/distributor/DistributorNodeHandler.js";
import { InMemoryRoundRobinCounter } from "../../infrastructure/persistence/memory/InMemoryRoundRobinCounter.js";
import { readMenuConfig } from "../../contracts/MenuConfig.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Menú y Distribuidor en el motor (C10).
// ---------------------------------------------------------------------------

const MENU_CONFIG = {
  format: "buttons",
  title: "Dilo Cantando",
  message: "¿Qué necesitas?",
  footer: "Responde con el número",
  options: [
    { id: "precios", title: "Precios" },
    { id: "horarios", title: "Horarios de atención" },
    { id: "asesor", title: "Hablar con un asesor" }
  ],
  saveToField: "interes"
};
const options = readMenuConfig(MENU_CONFIG).options;

const node = (type: FlowNode["type"], config: Record<string, unknown>): FlowNode =>
  ({ id: type, tenantId: "t", flowVersionId: "v", type, name: type, content: {}, config, metadata: {} });
const input = (payload: Record<string, unknown>, isWaitingInput: boolean): RuntimeInput => ({
  envelope: { tenantId: "t", flowKey: "f", channel: "web", conversationKey: "c", userKey: "u", messageId: "m", payload, receivedAt: "2026-11-08T19:30:00.000Z" },
  sessionContext: {},
  isWaitingInput,
  now: "2026-11-08T19:30:00.000Z",
  timezone: "UTC"
});
const session = { tenantId: "t", flowId: "f" } as Session;

describe("matchMenuReply", () => {
  it.each([
    ["botón nativo (id)", { optionId: "horarios" }, "horarios"],
    ["número", { text: "3" }, "asesor"],
    ["número con punto", { text: " 1. " }, "precios"],
    ["texto sin mayúsculas ni tildes", { text: "horarios de ATENCION" }, "horarios"]
  ])("reconoce: %s", (_label, reply, expected) => {
    expect(matchMenuReply(options, reply)?.id).toBe(expected);
  });

  it.each([["texto que no es opción", { text: "quiero comprar" }], ["número fuera de rango", { text: "7" }], ["vacío", { text: "  " }]])(
    "no reconoce: %s",
    (_label, reply) => {
      expect(matchMenuReply(options, reply)).toBeNull();
    }
  );

  it("el texto del menú numera las opciones (para canales sin botones)", () => {
    expect(renderMenuText(readMenuConfig(MENU_CONFIG))).toBe(
      "Dilo Cantando\n\n¿Qué necesitas?\n\n1. Precios\n2. Horarios de atención\n3. Hablar con un asesor\n\nResponde con el número"
    );
  });
});

describe("MenuNodeHandler", () => {
  it("la primera vez envía el menú (texto + botones nativos) y espera", async () => {
    const result = await new MenuNodeHandler().execute(node("menu", MENU_CONFIG), input({ text: "hola" }, false), session);

    expect(result.executionStatus).toBe("waiting_input");
    expect(result.outputMessages[0]?.interactive).toMatchObject({ type: "buttons", header: "Dilo Cantando", options: [{ id: "precios" }, { id: "horarios" }, { id: "asesor" }] });
  });

  it("al responder sale por la opción elegida y la guarda", async () => {
    const result = await new MenuNodeHandler().execute(node("menu", MENU_CONFIG), input({ text: "2" }, true), session);

    expect(result.output).toBe("horarios");
    expect(result.contextPatch).toEqual({ interes: "Horarios de atención" });
  });

  it("una respuesta que no es ninguna opción sale por «Otra respuesta»", async () => {
    const result = await new MenuNodeHandler().execute(node("menu", MENU_CONFIG), input({ text: "no sé" }, true), session);
    expect(result.output).toBe("menu-other");
  });

  it("con límite de tiempo declara el vencimiento de la espera", async () => {
    const result = await new MenuNodeHandler().execute(node("menu", { ...MENU_CONFIG, timeoutEnabled: true, timeoutAmount: 2, timeoutUnit: "hours" }), input({ text: "hola" }, false), session);
    // Relativo: cuenta desde que sale el menú (`waitFrom`; la entrega lo corrige si tarda).
    expect(result.nodeResult).toEqual({ waitDeadlineAt: "2026-11-08T21:30:00.000Z", waitFrom: "2026-11-08T19:30:00.000Z" });
  });
});

describe("DistributorNodeHandler", () => {
  const config = { outputs: [{ id: "a", label: "Ana" }, { id: "b", label: "Beto" }, { id: "c", label: "Carla" }] };

  it("reparte por turnos en el orden de las salidas y vuelve a empezar", async () => {
    const handler = new DistributorNodeHandler(new InMemoryRoundRobinCounter());
    const outputs = [];
    for (let i = 0; i < 5; i += 1) outputs.push((await handler.execute(node("distributor", config), input({}, false), session)).output);
    expect(outputs).toEqual(["a", "b", "c", "a", "b"]);
  });

  it("los turnos son por cuenta: otra cuenta empieza desde el principio", async () => {
    const handler = new DistributorNodeHandler(new InMemoryRoundRobinCounter());
    await handler.execute(node("distributor", config), input({}, false), session);
    const other = await handler.execute(node("distributor", config), input({}, false), { tenantId: "otra", flowId: "f" } as Session);
    expect(other.output).toBe("a");
  });

  it("sin salidas, la rama termina sin error", async () => {
    const result = await new DistributorNodeHandler(new InMemoryRoundRobinCounter()).execute(node("distributor", {}), input({}, false), session);
    expect(result.executionStatus).toBe("success");
    expect(result.output).toBeUndefined();
  });
});
