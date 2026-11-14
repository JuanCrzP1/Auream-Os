import { readString } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Ir a otro flujo (la «Conexión de flujo» de Leona) — contrato compartido por
// el editor y el motor (`GoToFlowNodeHandler`). Termina este flujo y el
// cliente sigue, en el mismo momento, en el inicio del flujo elegido: lo que
// el otro flujo envía sale en el mismo turno. Los datos que guardó este flujo
// pasan al otro (como en Leona, donde viven en el cliente). El bloque no tiene
// salidas: la conversación sigue allá.
//
// Protecciones: no puede elegir su propio flujo; si el elegido no existe, está
// archivado o pausado, el salto no ocurre y queda anotado; y una cadena de
// saltos en un mismo turno (A → B → A…) se corta a los `GO_TO_FLOW_MAX_CHAIN`.
// ---------------------------------------------------------------------------

export interface GoToFlowConfig {
  /** El id del flujo de destino (estable aunque lo renombren). */
  readonly flowId: string;
  /** Su nombre cuando se eligió, para mostrarlo sin consultar (el motor usa el id). */
  readonly flowName: string;
}

export const GO_TO_FLOW_DEFAULT_CONFIG: GoToFlowConfig = { flowId: "", flowName: "" };

/** Saltos seguidos en un mismo turno, como máximo. */
export const GO_TO_FLOW_MAX_CHAIN = 5;

export function readGoToFlowConfig(config: Readonly<Record<string, unknown>>): GoToFlowConfig {
  return { flowId: readString(config.flowId).trim(), flowName: readString(config.flowName).trim().slice(0, 120) };
}

/** Lo que el motor devuelve cuando el bloque pide el salto: quien corre el turno lo hace. */
export interface FlowHandoff {
  readonly flowId: string;
  readonly flowName: string;
  /** Los datos de este flujo (sin los internos `__…`), para que el otro los siga usando. */
  readonly context: Readonly<Record<string, unknown>>;
}

/** Marca del mensaje que arranca el flujo de destino: cuántos saltos lleva el turno y qué datos trae. */
export const HANDOFF_PAYLOAD = { depth: "handoffDepth", context: "carriedContext" } as const;
