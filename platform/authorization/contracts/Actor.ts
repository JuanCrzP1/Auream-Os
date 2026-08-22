import type { Scope } from "./Scope";

// Actor es la representación de identidad dentro del módulo access.
// Se deriva de RequestContext via ActorFactory — nunca se construye manualmente.
export interface Actor {
  readonly actorId: string;
  readonly tenantId: string;
  readonly scopes: ReadonlyArray<Scope>;
}
