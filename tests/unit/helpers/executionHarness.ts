/**
 * Harness compartido para las pruebas del ExecutionLoop.
 * Responsabilidad única: construir sesiones, envelopes y un loop ya cableado.
 */

import { ExecutionLoop } from "../../../flow-engine/execution/ExecutionLoop.js";
import { EdgeEvaluator } from "../../../flow-engine/edges/EdgeEvaluator.js";
import { ExecutionEventTracker } from "../../../flow-engine/execution/ExecutionEventTracker.js";
import { SessionService } from "../../../domains/sessions/application/SessionService.js";
import { ContextService } from "../../../domains/sessions/application/ContextService.js";
import { NodeRuntime } from "../../../flow-engine/nodes/NodeRuntime.js";
import { MessageNodeHandler } from "../../../flow-engine/nodes/message/MessageNodeHandler.js";
import { QuestionNodeHandler } from "../../../flow-engine/nodes/question/QuestionNodeHandler.js";
import { EndNodeHandler } from "../../../flow-engine/nodes/end/EndNodeHandler.js";
import { AnalyticsService } from "../../../domains/analytics/application/AnalyticsService.js";
import { InMemorySessionRepository } from "../../../infrastructure/persistence/memory/InMemorySessionRepository.js";
import { validLeadCaptureFlow } from "../../fixtures/flows/validLeadCaptureFlow.js";
import type { Session } from "../../../contracts/RuntimeContracts.js";
import type { InboundEnvelope } from "../../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  return {
    id: "session-test",
    tenantId: "tenant-test",
    flowId: "flow-lead-capture",
    flowVersionId: "v1",
    channel: "web",
    conversationKey: "conv-test",
    userKey: "user-test",
    currentNodeId: "node-entry",
    status: "active",
    revision: 1,
    context: {},
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as Session;
}

export function makeEnvelope(text = "hola"): InboundEnvelope {
  return {
    tenantId: "tenant-test",
    flowKey: "lead-capture",
    channel: "web",
    conversationKey: "conv-test",
    userKey: "user-test",
    messageId: "msg-test",
    payload: { text },
    receivedAt: new Date().toISOString()
  };
}

export function buildLoop(): ExecutionLoop {
  const analytics = new AnalyticsService();
  const sessionRepo = new InMemorySessionRepository();
  return new ExecutionLoop(
    new SessionService(sessionRepo),
    new ContextService(),
    new NodeRuntime([
      new MessageNodeHandler(),
      new QuestionNodeHandler(),
      new EndNodeHandler()
    ]),
    new EdgeEvaluator(),
    new ExecutionEventTracker(analytics)
  );
}
