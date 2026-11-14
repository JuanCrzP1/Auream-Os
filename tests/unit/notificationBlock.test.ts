import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { NotificationNodeHandler } from "../../flow-engine/nodes/notification/NotificationNodeHandler.js";
import { templateResolver } from "../../flow-engine/templates/templateResolver.js";
import { ConnectionChannelServices } from "../../domains/connections/application/ConnectionChannelServices.js";
import type { WhatsAppMessenger } from "../../domains/connections/application/ports/WhatsAppMessenger.js";
import { connectionSecretContext, type WhatsAppConnection } from "../../domains/connections/domain/WhatsAppConnection.js";
import { FlowTurn } from "../../domains/messaging/application/FlowTurn.js";
import type { FlowRunResult } from "../../contracts/FlowTimerContracts.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { InboundEnvelope, OutboundMessage, RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";

// ---------------------------------------------------------------------------
// Notificación, como en Leona: un aviso por WhatsApp a un número del equipo,
// enviado por el MISMO número conectado que atiende el chat, con variables
// (contacto, datos del flujo, `{fecha}` y `{hora}`). No queda en el chat del
// cliente, y un aviso mal configurado no detiene la venta.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const ENVELOPE: InboundEnvelope = { tenantId: T, flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "584121112233", messageId: "m", payload: {}, receivedAt: "2026-11-09T19:35:00.000Z" };
const input = (context: Record<string, unknown> = {}): RuntimeInput => ({ envelope: ENVELOPE, sessionContext: context, isWaitingInput: false, now: "2026-11-09T19:35:00.000Z", timezone: "America/Bogota" });
const session = { tenantId: T, flowId: "f", context: {} } as unknown as Session;
const node = (config: Record<string, unknown>) => ({ id: "aviso", tenantId: T, flowVersionId: "v", type: "notification", name: "Notificación", content: {}, config, metadata: {} }) as unknown as FlowNode;
const VENTA = { name: "Venta realizada Venezuela", countryCode: "57", phone: "310 555 0117", message: "Venta realizada ✅\nNombre: {full_name}\nBs {comprobante.valor}\nHora {hora}\nDía {data}" };

describe("NotificationNodeHandler", () => {
  it("arma el aviso con sus variables y lo dirige al número del equipo (prefijo + número), sin detener el flujo", async () => {
    const result = await new NotificationNodeHandler().execute(node(VENTA), input({ full_name: "Laura Gómez", "comprobante.valor": "1.250" }), session);
    expect(result.executionStatus).toBe("success");
    expect(result.outputMessages).toEqual([
      { channel: "whatsapp", conversationKey: "c", content: "Venta realizada ✅\nNombre: Laura Gómez\nBs 1.250\nHora 14:35\nDía 09/11", recipient: { phone: "573105550117", name: "Venta realizada Venezuela" } }
    ]);
  });

  it("sin número válido o sin texto no avisa, pero el flujo sigue y queda anotado", async () => {
    const handler = new NotificationNodeHandler();
    const noPhone = await handler.execute(node({ ...VENTA, phone: "123" }), input(), session);
    const noText = await handler.execute(node({ ...VENTA, message: "   " }), input(), session);
    expect([noPhone.executionStatus, noPhone.outputMessages, noPhone.nodeResult]).toEqual(["success", [], { notified: false, reason: "invalid_phone" }]);
    expect([noText.executionStatus, noText.nodeResult]).toEqual(["success", { notified: false, reason: "empty_message" }]);
  });
});

describe("variables del reloj", () => {
  it("`{fecha}`, `{hora}` y `{data}` (día/mes, como en Leona) en la zona del negocio; un dato del flujo con ese nombre manda", () => {
    const resolve = templateResolver(input(), null);
    expect([resolve("fecha"), resolve("hora"), resolve("data")]).toEqual(["09/11/2026", "14:35", "09/11"]);
    expect(templateResolver(input({ fecha: "el martes" }), null)("fecha")).toBe("el martes");
  });
});

describe("entrega del aviso", () => {
  it("sale por el número conectado del chat hacia el teléfono del equipo; lo demás, al cliente", async () => {
    const repository = new InMemoryConnectionRepository();
    const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
    const at = new Date().toISOString();
    const connection: WhatsAppConnection = {
      id: CONNECTION, tenantId: T, name: "Ventas", method: "qr", status: "connected", phoneNumber: "573013815302", profileName: null,
      providerRef: "inst", providerSecret: cipher.encrypt("token", connectionSecretContext(T, CONNECTION)), lastConnectedAt: at, createdAt: at, updatedAt: at
    };
    await repository.save(connection);
    const send = vi.fn(async () => ({ providerMessageId: "wa-1" }));
    const messenger = { send, inboundMedia: vi.fn() } as unknown as WhatsAppMessenger;
    const channel = new ConnectionChannelServices(repository, { for: () => messenger }, cipher, async () => undefined);

    await channel.deliver(T, CONNECTION, "584121112233", [
      { channel: "whatsapp", conversationKey: "c", content: "¡Gracias por tu compra!" },
      { channel: "whatsapp", conversationKey: "c", content: "Venta realizada", recipient: { phone: "573105550117", name: "Ventas" } }
    ]);

    expect(send.mock.calls.map((call) => [(call as unknown[])[1], ((call as unknown[])[2] as OutboundMessage).content])).toEqual([
      ["584121112233", "¡Gracias por tu compra!"],
      ["573105550117", "Venta realizada"]
    ]);
  });

  it("el aviso no queda en el chat del cliente; sus mensajes sí", async () => {
    const outputs: OutboundMessage[] = [
      { channel: "whatsapp", conversationKey: "c", content: "¡Gracias por tu compra!" },
      { channel: "whatsapp", conversationKey: "c", content: "Venta realizada", recipient: { phone: "573105550117", name: "Ventas" } }
    ];
    const result = { executionStatus: "success", outputMessages: outputs, contextPatch: {}, nodeResult: {}, domainEvents: [] } as FlowRunResult;
    const recorded: string[] = [];
    const turn = new FlowTurn(
      { handle: async () => result },
      {
        deliver: async (_t, _c, _p, messages, onResult) => {
          const results = messages.map((message) => ({ message, ok: true }));
          for (const sent of results) await onResult?.(sent);
          return { sent: results.length, failures: [], results };
        }
      },
      { recordOutbound: async (_t, _c, sent) => void recorded.push(...sent.map((item) => item.message.content)) },
      { afterTurn: async () => undefined }
    );
    await turn.run({ tenantId: T, connectionId: CONNECTION, phone: "584121112233", conversationKey: "c", flowKey: "f", conversationId: "chat" }, ENVELOPE);
    expect(recorded).toEqual(["¡Gracias por tu compra!"]);
  });
});
