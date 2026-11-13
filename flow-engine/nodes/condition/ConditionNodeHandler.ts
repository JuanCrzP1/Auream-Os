import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { CONDITION_OUTPUT, readConditionConfig } from "../../../contracts/ConditionConfig";
import type { NodeHandler } from "../NodeHandler";
import type { ContactProfile } from "../../../contracts/ContactContracts";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import { customFieldValue } from "../../values/customFieldValue";
import { evaluateCondition, type ConditionFacts } from "./evaluateCondition";

// ---------------------------------------------------------------------------
// ConditionNodeHandler — evalúa las reglas del Condicional y sale por
// «Se cumple» (`true`) o «No se cumple» (`false`). Ver `evaluateCondition`.
// ---------------------------------------------------------------------------

/**
 * Hechos del contacto y la conversación. Datos y etiquetas: el contacto manda.
 * Campos: lo que el cliente dijo en esta conversación manda y la ficha
 * completa (igual que los mensajes, `customFieldValue`).
 */
function factsFrom(input: RuntimeInput, profile: ContactProfile | null): ConditionFacts {
  const context = input.sessionContext;
  const contact: Readonly<Record<string, unknown>> = {
    name: profile?.name ?? context["full_name"] ?? context["name"] ?? context["first_name"],
    phone: profile?.phone ?? context["phone"] ?? input.envelope.userKey,
    email: profile?.email ?? context["email"]
  };
  const inboundText = input.envelope.payload["text"];

  return {
    now: new Date(input.now),
    timezone: input.timezone,
    // Si la ejecución la disparó un mensaje del cliente, ese es el último.
    lastInboundAt: typeof inboundText === "string" ? input.envelope.receivedAt : null,
    contactField: (name) => contact[name],
    customField: (name) => customFieldValue(name, context, profile),
    ...(profile ? { tags: profile.tags } : {})
  };
}

export class ConditionNodeHandler implements NodeHandler {
  public constructor(private readonly contacts: ContactDirectory) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "condition";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readConditionConfig(node.config);
    const profile = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const evaluation = evaluateCondition(config, factsFrom(input, profile));
    const unavailable = evaluation.rules.filter((rule) => rule.unavailable);

    return {
      executionStatus: "success",
      output: evaluation.met ? CONDITION_OUTPUT.met : CONDITION_OUTPUT.unmet,
      outputMessages: [],
      contextPatch: {},
      nodeResult: { conditionMet: evaluation.met, rules: evaluation.rules },
      domainEvents: [
        `condition_node_executed:${node.id}:${evaluation.met ? "met" : "unmet"}`,
        ...(config.rules.length === 0 ? [`condition_without_rules:${node.id}`] : []),
        ...unavailable.map((rule) => `condition_fact_unavailable:${node.id}:${rule.ruleId}`)
      ]
    };
  }
}
