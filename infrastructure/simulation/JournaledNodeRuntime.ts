import type { FlowNode } from "../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../contracts/RuntimeContracts";
import { NodeRuntime } from "../../flow-engine/nodes/NodeRuntime";
import type { SimulationJournal } from "../../domains/automations/simulation/domain/SimulationJournal";

/**
 * Los bloques de siempre, anotando cada uno en la bitácora de la prueba: qué
 * devolvió y lo que hicieron sus efectos mientras corría. El motor no cambia.
 */
export class JournaledNodeRuntime extends NodeRuntime {
  public constructor(
    private readonly inner: NodeRuntime,
    private readonly journal: SimulationJournal
  ) {
    super([]);
  }

  public override async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    this.journal.begin(node.id);
    const result = await this.inner.execute(node, input, session);
    this.journal.end(result);
    return result;
  }
}
