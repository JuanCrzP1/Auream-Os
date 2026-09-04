import { describe, expect, it } from "vitest";
import { MessageNodeHandler } from "../../flow-engine/nodes/message/MessageNodeHandler.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Comportamiento del nodo Mensaje.
//
// No se prueba que el handler exista: se prueba lo que EMITE. Un nodo con tres
// contenidos de texto tiene que producir tres mensajes, en su orden, con las
// variables ya resueltas.
//
// La secuencia vive en `config.items` y llega desde un JSON persistido, así que
// también se prueba lo que ocurre cuando ese JSON no tiene la forma esperada:
// el motor no puede caerse por un flujo guardado por una versión anterior.
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<FlowNode> = {}): FlowNode {
  return {
    id: "n-mensaje",
    tenantId: "tenant-test",
    flowVersionId: "v1",
    type: "message",
    name: "Mensaje",
    content: {},
    config: {},
    metadata: {},
    ...overrides
  };
}

function makeInput(): RuntimeInput {
  return {
    envelope: {
      tenantId: "tenant-test",
      flowKey: "flow-test",
      channel: "whatsapp",
      conversationKey: "conv-1",
      userKey: "user-1",
      messageId: "msg-1",
      payload: {},
      receivedAt: new Date().toISOString()
    },
    sessionContext: {},
    isWaitingInput: false
  };
}

function makeSession(context: Record<string, unknown> = {}): Session {
  const now = new Date().toISOString();
  return {
    id: "s-1",
    tenantId: "tenant-test",
    flowId: "flow-1",
    flowVersionId: "v1",
    channel: "whatsapp",
    conversationKey: "conv-1",
    userKey: "user-1",
    currentNodeId: "n-mensaje",
    status: "active",
    revision: 1,
    context,
    createdAt: now,
    updatedAt: now
  };
}

const handler = new MessageNodeHandler();

function run(node: FlowNode, context: Record<string, unknown> = {}) {
  return handler.execute(node, makeInput(), makeSession(context));
}

describe("MessageNodeHandler — secuencia de textos", () => {
  it("emite un mensaje por cada contenido de texto", () => {
    const node = makeNode({
      config: {
        items: [
          { id: "1", kind: "text", text: "Hola" },
          { id: "2", kind: "text", text: "¿Te ayudo?" }
        ]
      }
    });

    expect(run(node).outputMessages).toHaveLength(2);
  });

  it("conserva el orden de la secuencia", () => {
    const node = makeNode({
      config: {
        items: [
          { id: "1", kind: "text", text: "primero" },
          { id: "2", kind: "text", text: "segundo" },
          { id: "3", kind: "text", text: "tercero" }
        ]
      }
    });

    expect(run(node).outputMessages.map((m) => m.content)).toEqual([
      "primero",
      "segundo",
      "tercero"
    ]);
  });

  it("dirige cada mensaje al canal y la conversación del envelope", () => {
    const node = makeNode({ config: { items: [{ id: "1", kind: "text", text: "Hola" }] } });

    const [mensaje] = run(node).outputMessages;
    expect(mensaje.channel).toBe("whatsapp");
    expect(mensaje.conversationKey).toBe("conv-1");
  });

  it("resuelve las variables de contexto en cada contenido", () => {
    const node = makeNode({
      config: {
        items: [
          { id: "1", kind: "text", text: "Hola {{context.nombre}}" },
          { id: "2", kind: "text", text: "Tu plan es {{context.plan}}" }
        ]
      }
    });

    expect(run(node, { nombre: "Ana", plan: "Pro" }).outputMessages.map((m) => m.content)).toEqual([
      "Hola Ana",
      "Tu plan es Pro"
    ]);
  });

  it("sustituye por vacío una variable que no está en el contexto", () => {
    const node = makeNode({ config: { items: [{ id: "1", kind: "text", text: "Hola {{context.nombre}}" }] } });

    expect(run(node).outputMessages[0].content).toBe("Hola ");
  });

  it("continúa el flujo", () => {
    const node = makeNode({ config: { items: [{ id: "1", kind: "text", text: "Hola" }] } });

    expect(run(node).executionStatus).toBe("success");
  });
});

describe("MessageNodeHandler — contenidos que el motor no puede entregar", () => {
  const conMedios = makeNode({
    config: {
      items: [
        { id: "1", kind: "text", text: "Mira esto" },
        { id: "2", kind: "image", caption: "captura" },
        { id: "3", kind: "text", text: "¿Qué te parece?" }
      ]
    }
  });

  it("no inventa un envío para los medios", () => {
    expect(run(conMedios).outputMessages.map((m) => m.content)).toEqual([
      "Mira esto",
      "¿Qué te parece?"
    ]);
  });

  it("deja constancia observable de lo omitido, en lugar de callarlo", () => {
    expect(run(conMedios).domainEvents).toContain("message_item_not_deliverable:n-mensaje:image");
  });

  it("no falla el nodo por contener medios: el texto sí se entrega", () => {
    expect(run(conMedios).executionStatus).toBe("success");
  });
});

describe("MessageNodeHandler — compatibilidad y datos no fiables", () => {
  it("sigue enviando un nodo antiguo que solo tiene content.text", () => {
    const node = makeNode({ content: { text: "Mensaje de siempre" } });

    expect(run(node).outputMessages.map((m) => m.content)).toEqual(["Mensaje de siempre"]);
  });

  it("da prioridad a la secuencia cuando el nodo tiene las dos cosas", () => {
    const node = makeNode({
      content: { text: "viejo" },
      config: { items: [{ id: "1", kind: "text", text: "nuevo" }] }
    });

    expect(run(node).outputMessages.map((m) => m.content)).toEqual(["nuevo"]);
  });

  it("no emite nada cuando el nodo no tiene contenidos", () => {
    expect(run(makeNode()).outputMessages).toEqual([]);
  });

  it("no se cae si `items` no es una lista", () => {
    const node = makeNode({ config: { items: "esto no es una lista" } });

    expect(() => run(node)).not.toThrow();
    expect(run(node).outputMessages).toEqual([]);
  });

  it("descarta las entradas ilegibles y conserva las buenas", () => {
    const node = makeNode({
      config: {
        items: [null, { id: "1", kind: "text", text: "válido" }, 42, { sinKind: true }]
      }
    });

    expect(run(node).outputMessages.map((m) => m.content)).toEqual(["válido"]);
  });

  it("trata un texto ausente como vacío en vez de romper", () => {
    const node = makeNode({ config: { items: [{ id: "1", kind: "text" }] } });

    expect(run(node).outputMessages.map((m) => m.content)).toEqual([""]);
  });

  it("emite siempre el evento de ejecución del nodo", () => {
    expect(run(makeNode()).domainEvents).toContain("message_node_executed:n-mensaje");
  });
});
