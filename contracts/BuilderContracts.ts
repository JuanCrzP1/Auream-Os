/**
 * Contratos del módulo Builder.
 *
 * Define los tipos de capa de aplicación y persistencia del Builder:
 * workspaces, requests de simulación y estructuras derivadas.
 *
 * Estos tipos NO son modelo de grafo puro (eso vive en FlowSnapshot.ts).
 * Son tipos de la capa de aplicación del editor de flows.
 */
import type { BuilderFlowSnapshot } from "./FlowSnapshot";

// ---------------------------------------------------------------------------
// PersistedBuilderWorkspace
//
// Estado completo de un workspace del builder tal como se persiste en disco.
// Contiene el draft activo y el historial de snapshots publicados.
// ---------------------------------------------------------------------------

export interface PersistedBuilderWorkspace {
  readonly tenantId: string;
  readonly flowKey: string;
  readonly draft: BuilderFlowSnapshot;
  readonly publishedSnapshots: ReadonlyArray<BuilderFlowSnapshot>;
  readonly updatedAt: string;
  readonly autosaveRevision: number;
}

// ---------------------------------------------------------------------------
// BuilderSimulationRequest
//
// DTO de la API de simulación. Viene del frontend cuando el usuario
// escribe un mensaje en el simulador del builder.
// ---------------------------------------------------------------------------

export interface BuilderSimulationRequest {
  readonly message: string;
  readonly conversationKey: string;
  readonly userKey: string;
}
