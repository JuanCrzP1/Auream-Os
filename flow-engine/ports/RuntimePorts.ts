import type { FlowSnapshot } from "../../contracts/FlowSnapshot";
import type {
  InboundEnvelope,
  Session,
  SessionStatus,
  TenantContext
} from "../../contracts/RuntimeContracts";

// ---------------------------------------------------------------------------
// Puertos del runtime de automatizaciones.
//
// El motor de ejecución necesita leer y transicionar estado de sesión, pero NO
// debe conocer quién lo implementa. Estos puertos declaran exactamente lo que
// el runtime consume; el dominio `sessions` los satisface estructuralmente y
// la composición decide qué implementación se inyecta.
//
// Regla: el motor NO importa ningún dominio, ninguna capacidad de plataforma
// ni ninguna infraestructura concreta. Todo entra por estos puertos.
// ---------------------------------------------------------------------------

/**
 * Transiciones de sesión que necesita el loop de ejecución. Asíncronas
 * (FASE C5): en producción la sesión vive en la base de datos.
 */
export interface SessionStore {
  getOrCreateActive(tenantId: string, envelope: InboundEnvelope, snapshot: FlowSnapshot): Promise<Session>;
  moveToNode(session: Session, nextNodeId: string, status: SessionStatus): Promise<Session>;
  updateStatus(session: Session, status: SessionStatus): Promise<Session>;
}

/**
 * Aplicación de parches al contexto de la sesión. Síncrona a propósito: es una
 * transformación pura; lo que se persiste es la sesión resultante (SessionStore).
 */
export interface ContextWriter {
  applyPatch(session: Session, patch: Record<string, unknown>): Session;
}

/**
 * Resolución del contexto de tenant que ejecuta el flow.
 *
 * Es un puerto y no un import de `platform/tenancy` para que el motor siga
 * siendo autónomo: la composición inyecta la implementación real.
 */
export interface TenantContextResolver {
  resolve(tenantId: string): Promise<TenantContext>;
}

/** Destino de los eventos operativos emitidos por el runtime. */
export interface AnalyticsSink {
  track(eventName: string, payload: Record<string, unknown>): void;
}
