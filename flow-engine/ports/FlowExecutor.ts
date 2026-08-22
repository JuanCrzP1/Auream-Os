import type { InboundEnvelope, NodeExecutionResult } from "../../contracts/RuntimeContracts";

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
  handle(envelope: InboundEnvelope): NodeExecutionResult;
}
