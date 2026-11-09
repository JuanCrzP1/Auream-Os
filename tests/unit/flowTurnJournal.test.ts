import { describe, expect, it, vi } from "vitest";
import { FlowTurn } from "../../domains/messaging/application/FlowTurn.js";
import type { FlowTurnRecord, TurnJournal } from "../../domains/messaging/application/FlowTurnJournal.js";
import type { FlowRunResult } from "../../contracts/FlowTimerContracts.js";
import { timerEnvelope } from "../../contracts/FlowTimerContracts.js";
import type { InboundEnvelope } from "../../contracts/RuntimeContracts.js";
import type { DeliveryReport, OutboundDelivery } from "../../domains/messaging/application/ports/MessagingPorts.js";
import { composeTurnJournal, summarizeTurn } from "../../apps/api/composition/composeTurnJournal.js";

// ---------------------------------------------------------------------------
// Historial INTERNO de los turnos (no es una pantalla): cada turno queda
// anotado con qué lo inició, por qué bloques pasó, qué salió y qué falló, la
// espera programada y si reventó. Anotar nunca rompe el turno.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const TARGET = { tenantId: T, connectionId: "c", phone: "584121112233", conversationKey: "conv-2233", flowKey: "reconstruye", conversationId: "chat" };
const MESSAGE: InboundEnvelope = { tenantId: T, flowKey: "reconstruye", channel: "whatsapp", conversationKey: "conv-2233", userKey: "584121112233", messageId: "m", payload: { text: "Hola, quiero la canción" }, receivedAt: "2026-11-09T12:00:00.000Z" };
const RESULT = {
  executionStatus: "delayed",
  outputMessages: [{ channel: "whatsapp", conversationKey: "conv-2233", content: "Hola" }],
  contextPatch: {},
  nodeResult: {},
  domainEvents: ["delay_node_scheduled:intervalo"],
  steps: [{ nodeId: "m1", type: "message", status: "success" }, { nodeId: "intervalo", type: "delay", status: "delayed" }],
  session: { id: "s", flowId: "f", currentNodeId: "intervalo", status: "delayed", revision: 4 },
  wakeUp: { reason: "resume", at: "2026-11-09T12:03:00.000Z", nodeId: "intervalo", revision: 4 }
} as FlowRunResult;

function turn(options: { readonly handle?: () => Promise<FlowRunResult>; readonly journal: TurnJournal; readonly report?: DeliveryReport }) {
  const clock = { ms: Date.parse("2026-11-09T12:00:00.000Z") };
  const delivery: OutboundDelivery = {
    deliver: async () => {
      clock.ms += 1_200;
      return options.report ?? { sent: 1, failures: [], results: [] };
    }
  };
  return new FlowTurn({ handle: options.handle ?? (async () => RESULT) }, delivery, { recordOutbound: async () => undefined }, { afterTurn: async () => undefined }, () => new Date(clock.ms), options.journal);
}

describe("historial interno de los turnos", () => {
  it("anota un turno por mensaje: bloques, envíos, fallos, la espera y dónde quedó", async () => {
    const records: FlowTurnRecord[] = [];
    await turn({ journal: { record: async (entry) => void records.push(entry) }, report: { sent: 1, failures: ["uazapi: respondió 500."], results: [] } }).run(TARGET, MESSAGE);
    expect(records).toEqual([{
      tenantId: T, conversationId: "chat", conversationKey: "conv-2233", flowKey: "reconstruye",
      origin: "message", trigger: "Hola, quiero la canción",
      startedAt: "2026-11-09T12:00:00.000Z", finishedAt: "2026-11-09T12:00:01.200Z",
      steps: RESULT.steps, events: ["delay_node_scheduled:intervalo"],
      session: { nodeId: "intervalo", status: "delayed" },
      sent: 1, failures: ["uazapi: respondió 500."],
      wakeUp: { reason: "resume", at: "2026-11-09T12:03:00.000Z" }, error: null
    }]);
  });

  it("distingue el despertador y el envío a mano", async () => {
    const records: FlowTurnRecord[] = [];
    const journal = { record: async (entry: FlowTurnRecord) => void records.push(entry) };
    await turn({ journal }).run(TARGET, timerEnvelope({ tenantId: T, flowKey: "reconstruye", channel: "whatsapp", conversationKey: "conv-2233", userKey: "u", receivedAt: "2026-11-09T12:03:00.000Z" }, { reason: "resume", nodeId: "intervalo", revision: 4 }));
    await turn({ journal }).run(TARGET, { ...MESSAGE, payload: { text: "", manual: true } });
    expect(records.map((entry) => [entry.origin, entry.trigger])).toEqual([["timer", "resume:intervalo"], ["manual", "manual"]]);
  });

  it("si el turno revienta, queda anotado con el motivo y el error sigue su camino; si anotar falla, el turno no se entera", async () => {
    const records: FlowTurnRecord[] = [];
    const broken = turn({ handle: async () => { throw new Error("Nodo actual inexistente: x"); }, journal: { record: async (entry) => void records.push(entry) } });
    await expect(broken.run(TARGET, MESSAGE)).rejects.toThrow("Nodo actual inexistente");
    expect(records[0]).toMatchObject({ error: "Nodo actual inexistente: x", steps: [], session: null });

    const failingJournal = turn({ journal: { record: async () => { throw new Error("Neon no responde"); } } });
    await expect(failingJournal.run(TARGET, MESSAGE)).resolves.toMatchObject({ report: { sent: 1 } });
  });

  it("la línea del registro va resumida y sin el texto del cliente; si Neon falla, avisa", async () => {
    const records: FlowTurnRecord[] = [];
    await turn({ journal: { record: async (entry) => void records.push(entry) } }).run(TARGET, MESSAGE);
    const line = summarizeTurn(records[0]!);
    expect(line).toEqual({ tenantId: T, conversation: "2233", flow: "reconstruye", origin: "message", ms: 1_200, steps: ["message:success", "delay:delayed"], session: "delayed@intervalo", sent: 1, wakeUp: { reason: "resume", at: "2026-11-09T12:03:00.000Z" } });
    expect(JSON.stringify(line)).not.toContain("canción");

    const logger = { info: vi.fn(), warn: vi.fn() };
    await composeTurnJournal({ record: async () => { throw new Error("Neon no responde"); } }, logger).record(records[0]!);
    expect(logger.info).toHaveBeenCalledWith("flow.turn", line);
    expect(logger.warn).toHaveBeenCalledWith("flow.turn_log_failed", { error: "Neon no responde" });
  });
});
