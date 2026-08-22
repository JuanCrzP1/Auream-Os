import { describe, expect, it } from "vitest";
import { toInboundEnvelope } from "../../flow-engine/triggers/toInboundEnvelope.js";
import type { ExternalEvent, TriggerBinding } from "../../contracts/TriggerContracts.js";

const event: ExternalEvent = {
  tenantId: "tenant-a",
  connectionId: "conn-1",
  type: "message_received",
  channel: "whatsapp",
  conversationKey: "conv-42",
  userKey: "user-9",
  eventId: "evt-7",
  payload: { text: "hola" },
  occurredAt: "2026-01-01T00:00:00.000Z"
};

const binding: TriggerBinding = {
  tenantId: "tenant-a",
  connectionId: "conn-1",
  type: "message_received",
  flowKey: "lead-capture",
  isEnabled: true
};

describe("toInboundEnvelope", () => {
  it("traduce un evento externo al envelope que consume el motor", () => {
    const envelope = toInboundEnvelope(event, binding);

    expect(envelope).toEqual({
      tenantId: "tenant-a",
      flowKey: "lead-capture",
      channel: "whatsapp",
      conversationKey: "conv-42",
      userKey: "user-9",
      messageId: "evt-7",
      payload: { text: "hola" },
      receivedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("rechaza un binding de otro tenant", () => {
    const foreignBinding: TriggerBinding = { ...binding, tenantId: "tenant-b" };

    expect(() => toInboundEnvelope(event, foreignBinding)).toThrow(/Trigger cruzado entre tenants/);
  });
});
