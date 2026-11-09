import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { readIntervalConfig } from "../../../contracts/IntervalConfig";
import { resolveResumeAt } from "../../scheduling/resolveResumeAt";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// Programador (`delay`) — detiene el flujo y lo continúa más tarde.
//
//   1ª pasada   calcula cuándo seguir (espera, fecha y horario en la zona del
//               negocio: `resolveResumeAt`) y deja la sesión en `delayed` con
//               `nodeResult.resumeAt`. El motor lo devuelve como despertador y
//               la mensajería lo programa en la cola de tareas (FASE C6).
//   despertar   llega con `input.timer = "resume"`: el flujo sigue por su salida.
//
// Si el momento ya llegó (una fecha pasada, o dentro del horario sin espera)
// sigue en el acto. Una configuración que no permite calcularlo (fecha a medio
// escribir) tampoco detiene el flujo para siempre: sigue y lo deja anotado.
// ---------------------------------------------------------------------------

export class DelayNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "delay";
  }

  public async execute(node: FlowNode, input: RuntimeInput, _session: Session): Promise<NodeExecutionResult> {
    if (input.timer === "resume") {
      return { executionStatus: "success", outputMessages: [], contextPatch: {}, nodeResult: { resumed: true }, domainEvents: [`delay_resumed:${node.id}`] };
    }

    const now = new Date(input.now);
    const resumeAt = resolveResumeAt(readIntervalConfig(node.config), now, input.timezone);
    if (resumeAt === null || resumeAt.getTime() <= now.getTime()) {
      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: {},
        nodeResult: { resumed: true },
        domainEvents: [resumeAt === null ? `delay_config_incomplete:${node.id}` : `delay_elapsed:${node.id}`]
      };
    }

    return {
      executionStatus: "delayed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: { resumeAt: resumeAt.toISOString() },
      domainEvents: [`delay_node_scheduled:${node.id}`]
    };
  }
}
