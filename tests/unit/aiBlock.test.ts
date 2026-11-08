import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { AiNodeHandler } from "../../flow-engine/nodes/ai/AiNodeHandler.js";
import { intentInstructions, parseIntentReply } from "../../flow-engine/nodes/ai/aiIntentProtocol.js";
import { historyKey } from "../../flow-engine/nodes/ai/aiHistory.js";
import { runAiStep } from "../../flow-engine/nodes/ai/runAiStep.js";
import { readAiConfig, type AiIntent } from "../../contracts/AiConfig.js";
import type { AiGateway, AiGenerateRequest, AiGenerateResult } from "../../flow-engine/ports/AiGateway.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import { VaultAiGateway } from "../../apps/api/composition/VaultAiGateway.js";
import { AiCredentialVault } from "../../domains/integrations/application/AiCredentialVault.js";
import { InMemoryAiCredentialRepository } from "../../infrastructure/persistence/memory/InMemoryAiCredentialRepository.js";
import { AiProviderRegistry } from "../../infrastructure/ai/AiProviderRegistry.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { stripInlineSecrets } from "../../domains/automations/builder/application/stripInlineSecrets.js";
import type { AiProviderClient, AiChatRequest } from "../../infrastructure/ai/AiProviderClient.js";
import type { FlowNode, BuilderFlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Bloque Extensión IA: responde, clasifica intención (una salida por
// intención), recuerda la conversación si se pide y nunca toca una clave.
// ---------------------------------------------------------------------------

class FakeAi implements AiGateway {
  public requests: Array<{ tenantId: string; request: AiGenerateRequest }> = [];
  public constructor(private readonly answer: AiGenerateResult) {}
  public async generate(tenantId: string, request: AiGenerateRequest) {
    this.requests.push({ tenantId, request });
    return this.answer;
  }
}

const INTENTS: AiIntent[] = [
  { id: "i-precios", description: "pregunta por precios", key: "precios" },
  { id: "i-humano", description: "quiere hablar con una persona", key: "" }
];

const input = (text = "¿Cuánto cuesta el plan pro?", context: Record<string, unknown> = {}): RuntimeInput => ({
  envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "m", payload: { text }, receivedAt: "2026-11-08T00:00:00.000Z" },
  sessionContext: context,
  isWaitingInput: false,
  now: "2026-11-08T00:00:00.000Z",
  timezone: "UTC"
});
const session = (context: Record<string, unknown> = {}) => ({ tenantId: "t", context }) as unknown as Session;
const node = (config: Record<string, unknown>) =>
  ({ id: "ia", type: "ai", name: "IA", content: {}, config: { credentialId: "cred-1", model: "gpt-5.4-mini", ...config }, metadata: {} }) as unknown as FlowNode;

describe("protocolo de intención", () => {
  it("las instrucciones listan cada intención con su clave y la de respaldo", () => {
    const text = intentInstructions(INTENTS, "otro");
    expect(text).toContain('- "precios": pregunta por precios');
    expect(text).toContain('- "intencion_2": quiere hablar con una persona');
    expect(text).toContain('- "otro": ninguna de las anteriores');
  });

  it.each([
    ['{"intent":"precios","reply":"Cuesta $10"}', "i-precios", "Cuesta $10", false],
    ['Claro: {"intent": "PRECIOS", "reply": "Cuesta $10"} ¡gracias!', "i-precios", "Cuesta $10", false],
    ['{"intent":"intencion_2","reply":"Te paso con alguien"}', "i-humano", "Te paso con alguien", false],
    ['{"intent":"inventada","reply":"x"}', null, "x", false],
    ["Hola, ¿en qué te ayudo?", null, "Hola, ¿en qué te ayudo?", true],
    ['{"intent": "precios", "reply":', null, "", true]
  ])("%s", (text, intentId, reply, unparsed) => {
    const parsed = parseIntentReply(text, INTENTS);
    expect([parsed.intent?.id ?? null, parsed.reply, parsed.unparsed]).toEqual([intentId, reply, unparsed]);
  });
});

describe("AiNodeHandler", () => {
  const contacts = () => simulationDependencies().contacts;

  it("responde: instrucciones con variables, envía la respuesta y la guarda", async () => {
    const ai = new FakeAi({ ok: true, text: "El plan pro cuesta $49.", usage: { inputTokens: 30, outputTokens: 8 } });
    const result = await new AiNodeHandler(ai, contacts()).execute(
      node({ systemPrompt: "Eres asesor de {empresa|Auream}. Habla con {first_name|el cliente}.", responseVariable: "ia.respuesta" }),
      input(),
      session()
    );

    expect(ai.requests[0]).toMatchObject({
      tenantId: "t",
      request: { credentialId: "cred-1", model: "gpt-5.4-mini", system: "Eres asesor de Auream. Habla con el cliente.", json: false, messages: [{ role: "user", content: "¿Cuánto cuesta el plan pro?" }] }
    });
    expect(result.output).toBe("success");
    expect(result.outputMessages.map((m) => m.content)).toEqual(["El plan pro cuesta $49."]);
    expect(result.contextPatch).toEqual({ "ia.respuesta": "El plan pro cuesta $49." });
    expect(result.nodeResult).toMatchObject({ usage: { inputTokens: 30, outputTokens: 8 } });
  });

  it("con intenciones pide JSON y sale por la intención reconocida", async () => {
    const ai = new FakeAi({ ok: true, text: '{"intent":"precios","reply":"Cuesta $49"}' });
    const result = await new AiNodeHandler(ai, contacts()).execute(node({ intents: INTENTS }), input(), session());

    expect(ai.requests[0]!.request.json).toBe(true);
    expect(ai.requests[0]!.request.system).toContain('"precios"');
    expect(result.output).toBe("i-precios");
    expect(result.domainEvents).toContain("ai_classified:ia:precios");
  });

  it("intención desconocida → respaldo; sin enviar si autoSend está apagado", async () => {
    const result = await new AiNodeHandler(new FakeAi({ ok: true, text: '{"intent":"x","reply":"Hmm"}' }), contacts()).execute(
      node({ intents: INTENTS, autoSend: false, fallbackKey: "otro" }),
      input(),
      session()
    );
    expect([result.output, result.outputMessages.length, result.nodeResult["intent"]]).toEqual(["fallback", 0, "otro"]);
  });

  it("recuerda la conversación: envía el historial y lo amplía, sin pasar del límite", async () => {
    const previous = [
      { role: "user", content: "hola" },
      { role: "assistant", content: "¡Hola!" }
    ];
    const ai = new FakeAi({ ok: true, text: "Cuesta $49" });
    const result = await new AiNodeHandler(ai, contacts()).execute(
      node({ keepContext: true, contextTurns: 1 }),
      input(),
      session({ [historyKey("ia")]: previous })
    );

    expect(ai.requests[0]!.request.messages).toEqual([...previous, { role: "user", content: "¿Cuánto cuesta el plan pro?" }]);
    expect(result.contextPatch[historyKey("ia")]).toEqual([
      { role: "user", content: "¿Cuánto cuesta el plan pro?" },
      { role: "assistant", content: "Cuesta $49" }
    ]);
  });

  it("fallo del proveedor → Error, con el motivo en la variable de error", async () => {
    const result = await new AiNodeHandler(new FakeAi({ ok: false, reason: "quota_exceeded", message: "Sin saldo" }), contacts()).execute(
      node({ errorVariable: "ia.error" }),
      input(),
      session()
    );
    expect([result.output, result.contextPatch["ia.error"], result.domainEvents[0]]).toEqual(["failure", "Sin saldo", "ai_failed:ia:quota_exceeded"]);
  });

  it("sin conexión o modelo, o con el mensaje vacío, no llama al modelo", async () => {
    const ai = new FakeAi({ ok: true, text: "x" });
    const sinConexion = await new AiNodeHandler(ai, contacts()).execute(node({ credentialId: "" }), input(), session());
    const vacio = await new AiNodeHandler(ai, contacts()).execute(node({ userMessage: "{nada}" }), input(), session());
    expect([sinConexion.nodeResult["reason"], vacio.nodeResult["reason"], ai.requests.length]).toEqual(["not_configured", "empty_message", 0]);
  });

  it("en simulación sin IA sale por Error («no disponible»)", async () => {
    const deps = simulationDependencies();
    const result = await new AiNodeHandler(deps.ai, deps.contacts).execute(node({}), input(), session());
    expect([result.output, result.nodeResult["reason"]]).toEqual(["failure", "unavailable"]);
  });
});

describe("VaultAiGateway", () => {
  it("descifra la clave de la cuenta y llama al proveedor de la conexión; el motor nunca la ve", async () => {
    const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
    const repo = new InMemoryAiCredentialRepository();
    const tenant = "t";
    await repo.save({
      id: "cred-1", tenantId: tenant, provider: "gemini", name: "G", secret: cipher.encrypt("AIza-clave-real-0123456789", `ai-credential:${tenant}:cred-1`),
      hint: "••••6789", status: "active", lastVerifiedAt: null, createdAt: "x", updatedAt: "x"
    });
    const seen: AiChatRequest[] = [];
    const gemini: AiProviderClient = {
      id: "gemini",
      chat: async (request) => { seen.push(request); return { ok: true, text: "hola" }; },
      verifyKey: async () => ({ ok: true }),
      listModels: async () => ({ ok: true, models: [] })
    };
    const gateway = new VaultAiGateway(new AiCredentialVault(repo, cipher), new AiProviderRegistry([gemini]));
    const request = { credentialId: "cred-1", model: "gemini-2.5-flash", system: "", messages: [{ role: "user" as const, content: "x" }], json: false, maxOutputTokens: 10, timeoutMs: 10 };

    expect(await gateway.generate(tenant, request)).toEqual({ ok: true, text: "hola" });
    expect(seen[0]!.apiKey).toBe("AIza-clave-real-0123456789");
    expect(await gateway.generate("otra-cuenta", request)).toMatchObject({ ok: false, reason: "credential_not_found" });
  });
});

describe("un flujo no guarda claves", () => {
  it("stripInlineSecrets quita apiKey/provider de los bloques de IA y deja el resto", () => {
    const snapshot = {
      nodes: {
        ia: { id: "ia", type: "ai", config: { apiKey: "sk-viejo", provider: "gpt", model: "gpt-5.4-mini" } },
        msg: { id: "msg", type: "message", config: { apiKey: "no-es-de-ia" } }
      }
    } as unknown as BuilderFlowSnapshot;
    const clean = stripInlineSecrets(snapshot);
    expect(clean.nodes["ia"]!.config).toEqual({ model: "gpt-5.4-mini" });
    expect(clean.nodes["msg"]!.config).toEqual({ apiKey: "no-es-de-ia" });
    expect(stripInlineSecrets(clean)).toBe(clean);
  });

  it("readAiConfig ignora la clave vieja", () => {
    expect(readAiConfig({ apiKey: "sk-viejo", provider: "gpt" })).not.toHaveProperty("apiKey");
  });

  it("runAiStep: la prueba del editor recorre el mismo código", async () => {
    const ai = new FakeAi({ ok: true, text: '{"intent":"precios","reply":"Cuesta $49"}' });
    const step = await runAiStep(readAiConfig({ credentialId: "c", model: "m", intents: INTENTS }), { tenantId: "t", resolve: (n) => (n === "last_message" ? "precio?" : undefined), history: [] }, ai);
    expect([step.succeeded, step.output, step.intentKey, step.reply]).toEqual([true, "i-precios", "precios", "Cuesta $49"]);
  });
});
