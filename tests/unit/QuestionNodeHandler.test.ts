import { describe, expect, it } from "vitest";
import { QuestionNodeHandler } from "../../flow-engine/nodes/question/QuestionNodeHandler.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// El nodo `question` en ejecución — la herramienta «Esperar respuesta».
//
// Lo que se fija aquí es el COMPORTAMIENTO REAL del motor, no lo que la interfaz
// promete: qué se emite antes de esperar, qué se guarda al recibir la respuesta
// y qué se DECLARA sobre las capacidades que la plataforma todavía no tiene.
//
// Las dos limitaciones conocidas —vencer la espera y agrupar mensajes— se
// comprueban como lo que son: datos declarados en `nodeResult`, no efectos. Si
// alguien las diera por implementadas, estos tests seguirían pasando y el
// informe seguiría diciendo la verdad; lo que no puede ocurrir es que el dato
// desaparezca en silencio y el futuro planificador se quede sin él.
// ---------------------------------------------------------------------------

const handler = new QuestionNodeHandler();

function nodo(config: Record<string, unknown>, content: Record<string, unknown> = {}): FlowNode {
  return {
    id: "espera-1",
    tenantId: "t1",
    flowVersionId: "v1",
    type: "question",
    name: "Esperar respuesta",
    content,
    config,
    metadata: {}
  };
}

function entrada(overrides: Partial<RuntimeInput> = {}): RuntimeInput {
  return {
    envelope: {
      tenantId: "t1",
      flowKey: "flujo",
      channel: "whatsapp",
      conversationKey: "conv-1",
      userKey: "user-1",
      messageId: "msg-entrante",
      payload: {},
      receivedAt: "2026-01-01T10:00:00.000Z"
    },
    sessionContext: {},
    isWaitingInput: false,
    ...overrides
  };
}

const sesion = {} as Session;

describe("primera pasada: se emite el mensaje y se espera", () => {
  it("emite el mensaje previo y deja la sesión esperando", () => {
    const resultado = handler.execute(
      nodo({ waitIndefinitely: true }, { text: "¿En qué ciudad te encuentras?" }),
      entrada(),
      sesion
    );

    expect(resultado.executionStatus).toBe("waiting_input");
    expect(resultado.outputMessages).toEqual([
      {
        channel: "whatsapp",
        conversationKey: "conv-1",
        content: "¿En qué ciudad te encuentras?"
      }
    ]);
    expect(resultado.domainEvents).toEqual(["question_prompted:espera-1"]);
  });

  it("sin mensaje previo no emite nada y espera igual", () => {
    // El caso de un «Esperar respuesta» detrás de un Mensaje que ya preguntó.
    const resultado = handler.execute(nodo({}), entrada(), sesion);

    expect(resultado.executionStatus).toBe("waiting_input");
    expect(resultado.outputMessages).toEqual([]);
  });

  it("cita el mensaje del cliente cuando se pide responder al recibido", () => {
    const resultado = handler.execute(
      nodo({ replyToInbound: true }, { text: "¿Cuál es tu correo?" }),
      entrada(),
      sesion
    );

    expect(resultado.outputMessages[0]?.replyToMessageId).toBe("msg-entrante");
  });

  it("sin la opción no cita nada", () => {
    const resultado = handler.execute(nodo({}, { text: "¿Cuál es tu correo?" }), entrada(), sesion);

    expect(resultado.outputMessages[0]?.replyToMessageId).toBeUndefined();
  });
});

describe("segunda pasada: llega la respuesta", () => {
  const respondiendo = entrada({
    isWaitingInput: true,
    envelope: { ...entrada().envelope, messageId: "msg-respuesta", payload: { text: "Bogotá" } }
  });

  it("guarda la respuesta en el campo configurado y continúa", () => {
    const resultado = handler.execute(nodo({ targetKey: "ciudad" }), respondiendo, sesion);

    expect(resultado.executionStatus).toBe("success");
    expect(resultado.contextPatch).toEqual({ ciudad: "Bogotá" });
    expect(resultado.nodeResult).toMatchObject({ capturedInput: "Bogotá", storedKey: "ciudad" });
    expect(resultado.domainEvents).toEqual(["question_answered:espera-1"]);
  });

  it("acepta el destino escrito con prefijo y lo guarda sin él", () => {
    const resultado = handler.execute(nodo({ targetKey: "context.ciudad" }), respondiendo, sesion);

    expect(resultado.contextPatch).toEqual({ ciudad: "Bogotá" });
  });

  it("sin campo destino no escribe contexto pero sigue adelante", () => {
    const resultado = handler.execute(nodo({}), respondiendo, sesion);

    expect(resultado.executionStatus).toBe("success");
    expect(resultado.contextPatch).toEqual({});
    expect(resultado.nodeResult).toMatchObject({ capturedInput: "Bogotá" });
    expect(resultado.nodeResult).not.toHaveProperty("storedKey");
  });

  it("reacciona al mensaje del cliente, no al suyo propio", () => {
    const resultado = handler.execute(nodo({ reaction: "👍" }), respondiendo, sesion);

    expect(resultado.outputMessages).toEqual([
      {
        channel: "whatsapp",
        conversationKey: "conv-1",
        content: "👍",
        replyToMessageId: "msg-respuesta",
        kind: "reaction"
      }
    ]);
  });

  it("sin reacción configurada no emite ninguna salida al responder", () => {
    expect(handler.execute(nodo({}), respondiendo, sesion).outputMessages).toEqual([]);
  });

  it("una respuesta vacía no cuenta como respuesta: se sigue esperando", () => {
    const vacia = entrada({
      isWaitingInput: true,
      envelope: { ...entrada().envelope, payload: { text: "" } }
    });

    expect(handler.execute(nodo({}), vacia, sesion).executionStatus).toBe("waiting_input");
  });
});

describe("lo que la plataforma todavía no puede hacer se DECLARA, no se finge", () => {
  it("declara el vencimiento calculado desde la recepción real", () => {
    const resultado = handler.execute(
      nodo({ waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }),
      entrada(),
      sesion
    );

    // Sigue siendo `waiting_input`: NADA vence esta espera hoy —no hay cola—, y
    // el handler no puede inventarse un estado que el loop no sabe reanudar.
    expect(resultado.executionStatus).toBe("waiting_input");
    expect(resultado.nodeResult).toMatchObject({
      waitIndefinitely: false,
      waitTimeoutMs: 1_800_000,
      waitDeadlineAt: "2026-01-01T10:30:00.000Z"
    });
  });

  it("declara el vencimiento en horas", () => {
    const resultado = handler.execute(
      nodo({ waitIndefinitely: false, timeout: { amount: 2, unit: "hours" } }),
      entrada(),
      sesion
    );

    expect(resultado.nodeResult).toMatchObject({
      waitTimeoutMs: 7_200_000,
      waitDeadlineAt: "2026-01-01T12:00:00.000Z"
    });
  });

  it("sin límite no declara ningún vencimiento", () => {
    const resultado = handler.execute(nodo({ waitIndefinitely: true }), entrada(), sesion);

    expect(resultado.nodeResult).toMatchObject({ waitIndefinitely: true });
    expect(resultado.nodeResult).not.toHaveProperty("waitTimeoutMs");
    expect(resultado.nodeResult).not.toHaveProperty("waitDeadlineAt");
  });

  it("declara agrupar mensajes para el futuro búfer de entrada", () => {
    const resultado = handler.execute(nodo({ groupMessages: true }), entrada(), sesion);

    expect(resultado.nodeResult).toMatchObject({ groupMessages: true });
  });

  it("agrupar no altera hoy cómo se ejecuta la espera", () => {
    // El dato viaja; el comportamiento es idéntico. Si un día deja de serlo,
    // será porque alguien implementó el búfer, y este test lo señalará.
    const con = handler.execute(nodo({ groupMessages: true }), entrada(), sesion);
    const sin = handler.execute(nodo({ groupMessages: false }), entrada(), sesion);

    expect(con.executionStatus).toBe(sin.executionStatus);
    expect(con.outputMessages).toEqual(sin.outputMessages);
  });
});

describe("una recepción ilegible no puede tumbar la ejecución", () => {
  // El defecto real: `new Date(NaN).toISOString()` lanza `RangeError`, así que
  // un envelope con `receivedAt` malformado + un tiempo máximo configurado se
  // llevaba por delante la ejecución entera del flujo. El resto del handler ya
  // no confiaba en nada; esta era la única entrada que sí.
  const conLimite = nodo({ waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } });

  function conRecepcion(receivedAt: unknown): RuntimeInput {
    const base = entrada();
    return {
      ...base,
      envelope: { ...base.envelope, receivedAt: receivedAt as string }
    };
  }

  it("con receivedAt válido fecha el vencimiento", () => {
    const resultado = handler.execute(
      conLimite,
      conRecepcion("2026-01-01T10:00:00.000Z"),
      sesion
    );

    expect(resultado.nodeResult).toMatchObject({
      waitTimeoutMs: 1_800_000,
      waitDeadlineAt: "2026-01-01T10:30:00.000Z"
    });
  });

  it("no lanza con receivedAt inválido, vacío, ausente o de otro tipo", () => {
    for (const receivedAt of ["no-es-una-fecha", "", "   ", undefined, null, 0, {}, NaN]) {
      expect(() => handler.execute(conLimite, conRecepcion(receivedAt), sesion)).not.toThrow();
    }
  });

  it("sin fecha utilizable omite el vencimiento pero conserva la duración", () => {
    // La duración configurada es válida y se conoce; lo que no se puede decir es
    // a qué instante concreto vence. Inventarla desde el reloj del proceso
    // habría sido mentir sobre cuándo empezó la espera.
    const resultado = handler.execute(conLimite, conRecepcion("basura"), sesion);

    expect(resultado.nodeResult).toMatchObject({ waitIndefinitely: false, waitTimeoutMs: 1_800_000 });
    expect(resultado.nodeResult).not.toHaveProperty("waitDeadlineAt");
  });

  it("una recepción ilegible no altera nada más de la espera", () => {
    const resultado = handler.execute(
      nodo({ waitIndefinitely: false, timeout: { amount: 2, unit: "hours" } }, { text: "¿Ciudad?" }),
      conRecepcion(""),
      sesion
    );

    expect(resultado.executionStatus).toBe("waiting_input");
    expect(resultado.outputMessages[0]?.content).toBe("¿Ciudad?");
    expect(resultado.domainEvents).toEqual(["question_prompted:espera-1"]);
  });

  it("sin límite tampoco lanza con una recepción ilegible", () => {
    // No había vencimiento que fechar, así que este caso nunca falló; se fija
    // para que la corrección no dependa de por dónde entre la ejecución.
    expect(() =>
      handler.execute(nodo({ waitIndefinitely: true }), conRecepcion("basura"), sesion)
    ).not.toThrow();
  });
});

describe("configuración corrupta no rompe el motor", () => {
  it("un timeout inválido se ignora y la espera sigue siendo ejecutable", () => {
    const resultado = handler.execute(
      nodo({ waitIndefinitely: false, timeout: { amount: -3, unit: "siglos" } }),
      entrada(),
      sesion
    );

    expect(resultado.executionStatus).toBe("waiting_input");
    expect(resultado.nodeResult).not.toHaveProperty("waitTimeoutMs");
  });
});
