import { describe, expect, it, vi } from "vitest";
import { QuestionNodeHandler } from "../../flow-engine/nodes/question/QuestionNodeHandler.js";
import { ConversationTemplates } from "../../flow-engine/templates/ConversationTemplates.js";
import { readWaitResponseConfig, waitResponseRetryKey } from "../../contracts/WaitResponseConfig.js";
import type { ContactFieldCatalog } from "../../flow-engine/ports/ContactFieldCatalog.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Esperar respuesta guardando en un campo con tipo y «Preguntar de nuevo»: si
// la respuesta no encaja, le escribe qué se espera (citando lo que dijo) y la
// espera vuelve a empezar; hasta 2 veces, y después sigue con lo que escribió.
// Un campo de texto, una clave que no es campo o el bloque sin repreguntar:
// igual que siempre.
// ---------------------------------------------------------------------------

const catalog: ContactFieldCatalog = {
  find: vi.fn(async (_tenant: string, key: string) =>
    key === "ciudad" ? { type: "list" as const, options: ["Medellín", "Bogotá", "Cali"] } : key === "nota" ? { type: "text" as const, options: [] } : null
  )
};
const handler = new QuestionNodeHandler(new ConversationTemplates(), catalog);
const node = (config: Record<string, unknown>): FlowNode =>
  ({ id: "q1", tenantId: "t1", flowVersionId: "v1", type: "question", name: "¿Ciudad?", content: {}, config, metadata: {} });
const answer = (text: string, context: Record<string, unknown> = {}): RuntimeInput => ({
  envelope: { tenantId: "t1", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "u", messageId: "m-cliente", payload: { text }, receivedAt: "2026-11-13T10:00:00.000Z" },
  sessionContext: context,
  isWaitingInput: true
});
const session = { tenantId: "t1" } as Session;
const RETRY = { targetKey: "ciudad", onMismatch: "retry", waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } };
const KEY = waitResponseRetryKey("q1");

describe("volver a preguntar si la respuesta no encaja", () => {
  it("le dice las opciones, cita lo que escribió y la espera de 30 minutos empieza otra vez", async () => {
    const result = await handler.execute(node(RETRY), answer("Cartagena"), session);
    expect(result.executionStatus).toBe("waiting_input");
    expect(result.outputMessages).toEqual([expect.objectContaining({ content: "Elige una de estas: Medellín, Bogotá o Cali.", replyToMessageId: "m-cliente" })]);
    expect(result.contextPatch).toEqual({ [KEY]: 1 });
    expect(result.nodeResult).toMatchObject({ mismatch: true, attempt: 1, waitDeadlineAt: "2026-11-13T10:30:00.000Z" });
  });

  it("con un mensaje propio, usa ese (con sus variables)", async () => {
    const result = await handler.execute(node({ ...RETRY, retryMessage: "Escoge una ciudad de la lista 🙏" }), answer("Cartagena"), session);
    expect(result.outputMessages[0]?.content).toBe("Escoge una ciudad de la lista 🙏");
  });

  it("cuando encaja sigue, guarda la opción bien escrita y olvida los intentos", async () => {
    const result = await handler.execute(node(RETRY), answer("medellin", { [KEY]: 1 }), session);
    expect(result).toMatchObject({ executionStatus: "success", output: "respuesta", contextPatch: { ciudad: "Medellín", [KEY]: null } });
  });

  it("una lista guarda la opción bien escrita aunque no se pida repreguntar; lo demás, como lo escribió", async () => {
    expect((await handler.execute(node({ targetKey: "ciudad" }), answer("¡bogota!"), session)).contextPatch).toEqual({ ciudad: "Bogotá" });
    expect((await handler.execute(node({ targetKey: "nota" }), answer("  hola  "), session)).contextPatch).toEqual({ nota: "  hola  " });
    expect((await handler.execute(node({ targetKey: "ciudad" }), answer("Cartagena"), session)).contextPatch).toEqual({ ciudad: "Cartagena" });
  });

  it("después de 2 intentos sigue con lo que escribió (queda solo en la conversación)", async () => {
    const result = await handler.execute(node(RETRY), answer("Cartagena", { [KEY]: 2 }), session);
    expect(result).toMatchObject({ executionStatus: "success", output: "respuesta", contextPatch: { ciudad: "Cartagena", [KEY]: null } });
    expect(result.domainEvents).toContain("question_mismatch_kept:q1");
  });

  it("sin «preguntar de nuevo», con un campo de texto o una clave que no es campo: sigue como siempre", async () => {
    expect((await handler.execute(node({ ...RETRY, onMismatch: undefined }), answer("Cartagena"), session)).executionStatus).toBe("success");
    expect((await handler.execute(node({ ...RETRY, targetKey: "nota" }), answer("lo que sea"), session)).executionStatus).toBe("success");
    expect((await handler.execute(node({ ...RETRY, targetKey: "otra" }), answer("lo que sea"), session)).executionStatus).toBe("success");
  });

  it("el tiempo agotado también olvida los intentos", async () => {
    const result = await handler.execute(node(RETRY), { ...answer("", { [KEY]: 1 }), timer: "timeout", isWaitingInput: true }, session);
    expect(result).toMatchObject({ output: "tiempo-agotado", contextPatch: { [KEY]: null } });
  });

  it("el contrato lee la opción y el mensaje, e ignora lo desconocido", () => {
    expect(readWaitResponseConfig({ onMismatch: "retry", retryMessage: "  hola " })).toMatchObject({ onMismatch: "retry", retryMessage: "hola" });
    expect(readWaitResponseConfig({ onMismatch: "otra" })).not.toHaveProperty("onMismatch");
  });
});
