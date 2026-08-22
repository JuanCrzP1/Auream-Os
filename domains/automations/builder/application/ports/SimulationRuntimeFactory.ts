import type { BuilderSimulationRuntime } from "../BuilderSimulationRuntime";

// ---------------------------------------------------------------------------
// SimulationRuntimeFactory
//
// Puerto que SimulateDraftService usa para obtener un runtime de simulación
// aislado por tenant. Ensamblar ese runtime exige instanciar infraestructura
// concreta (registry y repositorio de sesiones), por lo que la implementación
// vive en la capa de composición, no en el dominio.
// ---------------------------------------------------------------------------

export interface SimulationRuntimeFactory {
  create(tenantId: string): BuilderSimulationRuntime;
}
