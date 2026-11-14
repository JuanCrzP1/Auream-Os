import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import { applySetField, isProtectedField, readSetFieldConfig } from "../../../contracts/SetFieldConfig";
import { renderTemplate } from "../../../contracts/TemplateVariables";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// SetFieldNodeHandler — el bloque «Guardar dato» (el Manipulador de Leona).
//
// Pone el valor (con sus variables ya puestas) o hace la cuenta con el número
// que el dato tiene ahora (de la conversación o de la ficha, como cualquier
// variable). Lo deja en la conversación: los bloques siguientes lo leen como
// `{campo}` y, si es un Campo del cliente, `FlowTurn` lo pasa a su ficha con
// su tipo (igual que Esperar respuesta). Salida única: pase lo que pase, el
// flujo sigue; una cuenta imposible no cambia nada y queda anotada.
// ---------------------------------------------------------------------------

export class SetFieldNodeHandler implements NodeHandler {
  public constructor(private readonly contacts: ContactDirectory) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "set-field";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readSetFieldConfig(node.config);
    if (!config.field || isProtectedField(config.field)) {
      return unchanged(node.id, config.field, `set_field_skipped:${node.id}:${config.field ? "protected" : "no_field"}`);
    }

    const contact = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const resolve = templateResolver(input, contact);
    const rendered = renderTemplate(config.value, resolve);
    const missing = rendered.missing.map((name) => `set_field_variable_missing:${node.id}:${name}`);
    const outcome = applySetField(config.operation, resolve(config.field), rendered.text.trim());

    if (!outcome.ok) {
      return unchanged(node.id, config.field, `set_field_${outcome.reason}:${node.id}:${config.field}`, missing);
    }

    return {
      executionStatus: "success",
      outputMessages: [],
      contextPatch: { [config.field]: outcome.value },
      nodeResult: { field: config.field, operation: config.operation, value: outcome.value },
      domainEvents: [`set_field_saved:${node.id}:${config.field}`, ...missing]
    };
  }
}

function unchanged(nodeId: string, field: string, event: string, extra: ReadonlyArray<string> = []): NodeExecutionResult {
  return {
    executionStatus: "success",
    outputMessages: [],
    contextPatch: {},
    nodeResult: { field, unchanged: true },
    domainEvents: [event, ...extra]
  };
}
