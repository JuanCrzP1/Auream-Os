import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { CONDITION_OUTPUT, readConditionConfig, type ConditionConfig } from "../../../contracts/ConditionConfig";
import { renderTemplate, type VariableResolver } from "../../../contracts/TemplateVariables";
import { variableAlias } from "../../../contracts/VariableCatalog";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";
import type { ContactProfile } from "../../../contracts/ContactContracts";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import { customFieldValue, hasCustomField } from "../../values/customFieldValue";
import { evaluateCondition, type ConditionFacts } from "./evaluateCondition";

// ---------------------------------------------------------------------------
// ConditionNodeHandler — evalúa las reglas del Condicional y sale por
// «Se cumple» (`true`) o «No se cumple» (`false`). Ver `evaluateCondition`.
//
// Como en Leona, el valor con que se compara puede llevar variables («la
// fecha del comprobante empieza con {data}», «es igual a {ref_anterior}»):
// se ponen antes de comparar. Y un campo con nombre de Leona
// (`comprovante.valor`) vale lo mismo que el de Auream si no existe tal cual.
// ---------------------------------------------------------------------------

/** Las reglas con sus variables ya puestas en el valor a comparar. */
function withVariables(config: ConditionConfig, resolve: VariableResolver): ConditionConfig {
  return { ...config, rules: config.rules.map((rule) => (rule.value.includes("{") ? { ...rule, value: renderTemplate(rule.value, resolve, "raw").text } : rule)) };
}

/**
 * Hechos del contacto y la conversación. Datos y etiquetas: el contacto manda.
 * Campos: lo que el cliente dijo en esta conversación manda y la ficha
 * completa (igual que los mensajes, `customFieldValue`).
 */
function factsFrom(input: RuntimeInput, profile: ContactProfile | null, resolve: VariableResolver): ConditionFacts {
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
    customField: (name) => {
      if (hasCustomField(name, context, profile)) return customFieldValue(name, context, profile);
      const alias = variableAlias(name);
      return alias ? resolve(alias) : customFieldValue(name, context, profile);
    },
    ...(profile ? { tags: profile.tags } : {}),
    ...(input.business ? { business: input.business } : {})
  };
}

export class ConditionNodeHandler implements NodeHandler {
  public constructor(private readonly contacts: ContactDirectory) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "condition";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const profile = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const resolve = templateResolver(input, profile);
    const config = withVariables(readConditionConfig(node.config), resolve);
    const evaluation = evaluateCondition(config, factsFrom(input, profile, resolve));
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
