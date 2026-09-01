import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// IntegrationNodeHandler
//
// Estado: NO IMPLEMENTADO.
//
// Un nodo de integración debe invocar un efecto externo (webhook, API de
// dominio, CRM). Ese ejecutor todavía no existe, así que el nodo NO se ejecuta:
// falla de forma explícita en lugar de simular un resultado.
//
// Antes este handler escribía en contexto un `config.mockResult` inventado, lo
// que hacía parecer que la acción se había ejecutado. Se retiró: el runtime real
// no finge integraciones.
//
// Se llamó `ActionNodeHandler` (tipo `action`). Es el mismo concepto con el
// nombre que usa el producto: una sola herramienta, no dos.
// ---------------------------------------------------------------------------

export class IntegrationNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "integration";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        integration: node.config.integrationName ?? node.name,
        reason: "integration_executor_not_implemented"
      },
      domainEvents: [`integration_node_not_implemented:${node.id}`]
    };
  }
}
