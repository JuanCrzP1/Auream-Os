/**
 * Contrato canónico del modelo de grafo.
 *
 * Esta es la única fuente de verdad para FlowSnapshot, FlowNode, FlowEdge
 * y tipos relacionados. El runtime, el builder, el validador, la simulación
 * y la publicación deben depender de este módulo, no de modelos propios.
 *
 * Prohibido duplicar estos tipos en otros módulos.
 */

// ---------------------------------------------------------------------------
// Tipos base
// ---------------------------------------------------------------------------

/**
 * Tipos de nodo que el Flow Engine sabe ejecutar.
 *
 * `handoff` NO está aquí de forma deliberada: la derivación a un asesor humano
 * es responsabilidad exclusiva del AI Sales Engine, no del motor de flows.
 * Ver docs/architecture/ai-sales-engine.md.
 */
export type NodeType =
  | "message"
  | "question"
  | "capture"
  | "action"
  | "condition"
  | "delay"
  | "fallback"
  | "end"
  | "ai";

export type EdgeOperator = "always" | "eq" | "neq" | "exists";

export type FlowVersionStatus = "draft" | "published" | "archived";

// ---------------------------------------------------------------------------
// EdgeCondition
// ---------------------------------------------------------------------------

export interface EdgeCondition {
  readonly operator: EdgeOperator;
  readonly fact?: string;
  readonly value?: string | number | boolean;
}

// ---------------------------------------------------------------------------
// FlowNode
// ---------------------------------------------------------------------------

export interface FlowNode {
  readonly id: string;
  readonly tenantId: string;
  readonly flowVersionId: string;
  readonly type: NodeType;
  readonly name: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly config: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// FlowEdge
// ---------------------------------------------------------------------------

export interface FlowEdge {
  readonly id: string;
  readonly tenantId: string;
  readonly flowVersionId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly priority: number;
  readonly isFallback: boolean;
  readonly condition: EdgeCondition;
}

// ---------------------------------------------------------------------------
// FlowMetadata
// ---------------------------------------------------------------------------

export interface FlowMetadata {
  readonly id: string;
  readonly tenantId: string;
  readonly key: string;
  readonly name: string;
  readonly currentPublishedVersionId: string | null;
}

// ---------------------------------------------------------------------------
// FlowVersion
// ---------------------------------------------------------------------------

export interface FlowVersion {
  readonly id: string;
  readonly tenantId: string;
  readonly flowId: string;
  readonly versionNumber: number;
  readonly status: FlowVersionStatus;
  readonly entryNodeId: string;
}

// ---------------------------------------------------------------------------
// FlowSnapshot
//
// Representa el estado completo e inmutable de un flow en una versión.
// Los nodos están indexados por id. Los edges están agrupados por nodo origen.
// ---------------------------------------------------------------------------

export interface FlowSnapshot {
  readonly flow: FlowMetadata;
  readonly version: FlowVersion;
  readonly nodes: Readonly<Record<string, FlowNode>>;
  readonly edgesBySource: Readonly<Record<string, ReadonlyArray<FlowEdge>>>;
}

// ---------------------------------------------------------------------------
// BuilderFlowNode
//
// Variante del nodo para el editor. No tiene tenantId/flowVersionId porque
// esos campos se completan al convertir a runtime.
// ---------------------------------------------------------------------------

export interface BuilderFlowNode {
  readonly id: string;
  readonly type: NodeType;
  readonly name: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly config: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// BuilderFlowEdge
// ---------------------------------------------------------------------------

export interface BuilderFlowEdge {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly priority: number;
  readonly isFallback: boolean;
  readonly condition: EdgeCondition;
}

// ---------------------------------------------------------------------------
// BuilderFlowSnapshot
//
// Snapshot ligero que vive en el editor. No tiene tenantId por defecto.
// Al publicar o simular se convierte a FlowSnapshot completo.
// ---------------------------------------------------------------------------

export interface BuilderFlowSnapshot {
  readonly flow: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  };
  readonly version: {
    readonly id: string;
    readonly versionNumber: number;
    readonly status: FlowVersionStatus;
    readonly entryNodeId: string;
  };
  readonly nodes: Readonly<Record<string, BuilderFlowNode>>;
  readonly edgesBySource: Readonly<Record<string, ReadonlyArray<BuilderFlowEdge>>>;
}

// ---------------------------------------------------------------------------
// BuilderSimulationRequest y PersistedBuilderWorkspace
// han sido movidos a BuilderContracts.ts
// ---------------------------------------------------------------------------

