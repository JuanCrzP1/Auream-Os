import { describe, expect, it, vi } from "vitest";
import { alignWakeUpToDelivery, type FlowRunResult, type FlowWakeUp } from "../../contracts/FlowTimerContracts.js";
import type { InboundEnvelope } from "../../contracts/RuntimeContracts.js";
import { FlowTurn } from "../../domains/messaging/application/FlowTurn.js";
import type { DeliveryReport, FlowRunner, FlowTimers, OutboundDelivery } from "../../domains/messaging/application/ports/MessagingPorts.js";

// ---------------------------------------------------------------------------
// Puntualidad de las esperas relativas («3 minutos», una pausa, un tiempo
// máximo): cuentan desde que salió DE VERDAD el último mensaje. El motor las
// planea con las pausas del turno; los envíos y la red tardan algo más, y el
// despertador se corre exactamente eso. Las horas fijas no se mueven.
// ---------------------------------------------------------------------------

const wake = (over: Partial<FlowWakeUp> = {}): FlowWakeUp => ({
  reason: "resume",
  at: "2026-11-09T12:03:18.000Z",
  nodeId: "intervalo",
  revision: 3,
  from: "2026-11-09T12:00:18.000Z",
  ...over
});

describe("alignWakeUpToDelivery", () => {
  it("una espera relativa se corre exactamente lo que la entrega real se pasó de lo planeado", () => {
    expect(alignWakeUpToDelivery(wake(), new Date("2026-11-09T12:00:20.400Z")).at).toBe("2026-11-09T12:03:20.400Z");
  });

  it("si la entrega terminó a tiempo no se mueve; una hora fija (sin `from`) tampoco", () => {
    expect(alignWakeUpToDelivery(wake(), new Date("2026-11-09T12:00:18.000Z")).at).toBe("2026-11-09T12:03:18.000Z");
    const { from: _relative, ...fixed } = wake({ at: "2026-11-10T13:00:00.000Z" });
    expect(alignWakeUpToDelivery(fixed, new Date("2026-11-09T12:00:40.000Z"))).toBe(fixed);
  });
});

describe("FlowTurn", () => {
  it("programa el despertador desde que terminó de verdad la entrega (pausas, envíos y red)", async () => {
    const clock = { ms: Date.parse("2026-11-09T12:00:00.000Z") };
    const result = { executionStatus: "delayed", outputMessages: [], contextPatch: {}, nodeResult: {}, domainEvents: [], wakeUp: wake() } as FlowRunResult;
    const runner: FlowRunner = { handle: vi.fn(async () => result) };
    // Planeado: 18 s de pausas. Real: 20,4 s (los envíos a WhatsApp tardaron 2,4 s).
    const delivery: OutboundDelivery = {
      deliver: vi.fn(async (): Promise<DeliveryReport> => {
        clock.ms += 20_400;
        return { sent: 0, failures: [], results: [] };
      })
    };
    const scheduled: FlowRunResult[] = [];
    const timers: FlowTimers = { afterTurn: vi.fn(async (_target, turnResult: FlowRunResult) => void scheduled.push(turnResult)) };
    const turn = new FlowTurn(runner, delivery, { recordOutbound: vi.fn(async () => undefined) }, timers, () => new Date(clock.ms));

    const target = { tenantId: "t", connectionId: "c", phone: "573000000000", conversationKey: "k", flowKey: "f", conversationId: "x" };
    await turn.run(target, { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "k", userKey: "u", messageId: "m", payload: {}, receivedAt: "2026-11-09T12:00:00.000Z" } as InboundEnvelope);

    expect(scheduled[0]?.wakeUp?.at).toBe("2026-11-09T12:03:20.400Z");
  });
});
