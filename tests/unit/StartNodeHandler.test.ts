import { describe, expect, it } from "vitest";
import { buildLoop, makeEnvelope, makeSession } from "./helpers/executionHarness.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";

describe("StartNodeHandler", () => {
  it("el inicio no envía nada al cliente: pasa directo al primer bloque", async () => {
    const session = makeSession({ currentNodeId: validLeadCaptureFlow.version.entryNodeId });
    const result = await buildLoop().run(validLeadCaptureFlow, session, makeEnvelope());

    expect(result.outputMessages[0]?.content).toBe("¡Hola! ¿Cuál es tu nombre?");
    expect(result.outputMessages.map((message) => message.content)).not.toContain("Inicio del flujo");
    expect(result.domainEvents).toContain("start_node_executed:node-start");
  });
});
