import { describe, expect, it, vi } from "vitest";
import { ConversationTemplates } from "../../flow-engine/templates/ConversationTemplates.js";
import { MessageNodeHandler } from "../../flow-engine/nodes/message/MessageNodeHandler.js";
import { MenuNodeHandler } from "../../flow-engine/nodes/menu/MenuNodeHandler.js";
import { QuestionNodeHandler } from "../../flow-engine/nodes/question/QuestionNodeHandler.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Variables en los textos que recibe el cliente: Mensaje, Menú y Esperar
// respuesta usan la misma plantilla que la Integración, con el contacto real.
// ---------------------------------------------------------------------------

const input: RuntimeInput = {
  envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "m", payload: { text: "hola" }, receivedAt: "2026-11-08T00:00:00.000Z" },
  sessionContext: {},
  isWaitingInput: false,
  now: "2026-11-08T00:00:00.000Z",
  timezone: "UTC"
};
const session = (context: Record<string, unknown> = {}) => ({ tenantId: "t", context }) as unknown as Session;
const node = (type: string, config: Record<string, unknown>, content: Record<string, unknown> = {}) =>
  ({ id: "n", type, name: "n", content, config, metadata: {} }) as unknown as FlowNode;

async function contactos() {
  const { contacts } = simulationDependencies();
  const ana = await contacts.resolve("t", { channel: "whatsapp", externalKey: "573001112233" });
  await contacts.setFields("t", ana.id, { ciudad: "Cali" });
  // El nombre llega por la ficha del contacto; aquí se simula con un campo del flujo.
  return contacts;
}

describe("Mensaje", () => {
  it("resuelve variables del sistema, campos del contacto y datos de la conversación", async () => {
    const templates = new ConversationTemplates(await contactos());
    const result = await new MessageNodeHandler(templates).execute(
      node("message", { items: [{ id: "1", kind: "text", text: "Hola {first_name}, ¿sigues en {ciudad}? Tu plan: {plan} ({phone})" }] }),
      input,
      session({ full_name: "Ana María", plan: "pro" })
    );
    expect(result.outputMessages[0]?.content).toBe("Hola Ana, ¿sigues en Cali? Tu plan: pro (573001112233)");
  });

  it("un texto sin variables no consulta el contacto", async () => {
    const contacts = await contactos();
    const resolve = vi.spyOn(contacts, "resolve");
    await new MessageNodeHandler(new ConversationTemplates(contacts)).execute(node("message", { items: [{ id: "1", kind: "text", text: "Hola, ¿en qué te ayudo?" }] }), input, session());
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("Menú y Esperar respuesta", () => {
  it("el Menú resuelve encabezado, mensaje y pie (no las opciones)", async () => {
    const templates = new ConversationTemplates(await contactos());
    const result = await new MenuNodeHandler(templates).execute(
      node("menu", { format: "buttons", title: "Hola {first_name}", message: "Opciones para {ciudad}", footer: "", options: [{ id: "a", title: "{ciudad}" }] }),
      input,
      session({ full_name: "Ana" })
    );
    expect(result.outputMessages[0]?.interactive).toMatchObject({ header: "Hola Ana", body: "Opciones para Cali", options: [{ id: "a", title: "{ciudad}" }] });
  });

  it("Esperar respuesta resuelve su mensaje previo", async () => {
    const templates = new ConversationTemplates(await contactos());
    const result = await new QuestionNodeHandler(templates).execute(node("question", {}, { text: "{first_name}, ¿cuál es tu correo?" }), input, session({ full_name: "Ana" }));
    expect(result.outputMessages[0]?.content).toBe("Ana, ¿cuál es tu correo?");
  });
});
