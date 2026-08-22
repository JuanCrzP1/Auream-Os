import type { RequestContext } from "../../../platform/identity/contracts/RequestContext.js";
import type { Actor } from "../../../platform/authorization/contracts/Actor.js";

/**
 * Constructores de RequestContext y Actor para pruebas de autorización.
 * Responsabilidad única: producir sujetos de prueba con scopes por defecto.
 */

const DEFAULT_SCOPES = ["flows.read", "flows.write", "flows.publish", "runtime.execute", "analytics.read"];

export function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    tenantId: "test-tenant",
    actorId: "actor-1",
    authMethod: "jwt",
    requestId: "req-001",
    scopes: DEFAULT_SCOPES,
    ...overrides
  };
}

export function makeActor(overrides: Partial<Actor> = {}): Actor {
  return {
    tenantId: "test-tenant",
    actorId: "actor-1",
    scopes: DEFAULT_SCOPES,
    ...overrides
  };
}
