import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { readDistributorOutputs } from "../../../contracts/DistributorConfig";
import type { RoundRobinCounter } from "../../ports/RoundRobinCounter";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// DistributorNodeHandler — reparte por turnos entre sus salidas, en el orden
// configurado: el 1.er cliente por la 1.ª, el 2.º por la 2.ª… y vuelta a
// empezar. Los turnos son por cuenta, flujo y bloque, compartidos entre
// conversaciones (`RoundRobinCounter`).
// ---------------------------------------------------------------------------

export class DistributorNodeHandler implements NodeHandler {
  public constructor(private readonly turns: RoundRobinCounter) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "distributor";
  }

  public async execute(node: FlowNode, _input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const outputs = readDistributorOutputs(node.config);

    if (outputs.length === 0) {
      // Sin salidas no hay a quién repartir: la rama termina aquí.
      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: {},
        nodeResult: {},
        domainEvents: [`distributor_without_outputs:${node.id}`]
      };
    }

    const turn = await this.turns.next(session.tenantId, `${session.flowId}:${node.id}`);
    const chosen = outputs[turn % outputs.length]!;

    return {
      executionStatus: "success",
      output: chosen.id,
      outputMessages: [],
      contextPatch: {},
      nodeResult: { distributorTurn: turn, distributorOutput: chosen.id },
      domainEvents: [`distributor_assigned:${node.id}:${chosen.id}`]
    };
  }
}
