import type { InboundEnvelope } from "../../contracts/RuntimeContracts";
import type { FlowRunResult } from "../../contracts/FlowTimerContracts";

// ---------------------------------------------------------------------------
// FlowExecutor
//
// Contrato público del Flow Engine: recibe un mensaje entrante y devuelve el
// resultado de avanzar la ejecución del flow.
//
// Es la única superficie que otros dominios consumen del motor. Automations lo
// usa para simular drafts desde el builder sin acoplarse al orquestador
// concreto ni a las piezas internas del runtime.
//
// ExecutionOrchestrator lo satisface estructuralmente.
// ---------------------------------------------------------------------------

export interface FlowExecutor {
  /** Un turno: avanza la sesión con el mensaje (o el despertador) y dice dónde quedó y cuándo despertarla. */
  handle(envelope: InboundEnvelope): Promise<FlowRunResult>;
}
