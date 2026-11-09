import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { intervalWaitMs, readIntervalConfig } from "../../../contracts/IntervalConfig";
import { resolveResumeAt } from "../../scheduling/resolveResumeAt";
import { waitStartsAt } from "../../scheduling/waitStartsAt";
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

    // La espera cuenta desde que sale el último mensaje del turno (tras sus pausas).
    const config = readIntervalConfig(node.config);
    const startsAt = new Date(waitStartsAt(Date.parse(input.now), input));
    const resumeAt = resolveResumeAt(config, startsAt, input.timezone);
    if (resumeAt === null || resumeAt.getTime() <= startsAt.getTime()) {
      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: {},
        nodeResult: { resumed: true },
        domainEvents: [resumeAt === null ? `delay_config_incomplete:${node.id}` : `delay_elapsed:${node.id}`]
      };
    }

    // «Espera 3 minutos» es relativa: si la entrega real tarda más de lo
    // planeado, la mensajería la corre (`waitFrom`). Una fecha fija, o el
    // inicio de una franja del horario, no se mueve.
    const wait = intervalWaitMs(config);
    const relative = wait !== null && resumeAt.getTime() === startsAt.getTime() + wait;
    return {
      executionStatus: "delayed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: { resumeAt: resumeAt.toISOString(), ...(relative ? { waitFrom: startsAt.toISOString() } : {}) },
      domainEvents: [`delay_node_scheduled:${node.id}`]
    };
  }
}
