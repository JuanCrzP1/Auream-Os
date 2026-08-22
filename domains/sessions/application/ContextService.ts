import type { Session } from "../../../contracts/RuntimeContracts";

// ---------------------------------------------------------------------------
// ContextService
//
// Aplica un patch al contexto de una sesión retornando una NUEVA sesión.
// No muta el objeto original. El llamador es responsable de usar
// la sesión retornada para las operaciones siguientes.
// ---------------------------------------------------------------------------

export class ContextService {
  public applyPatch(session: Session, patch: Record<string, unknown>): Session {
    if (Object.keys(patch).length === 0) {
      return session;
    }

    return {
      ...session,
      context: { ...session.context, ...patch },
      updatedAt: new Date().toISOString()
    };
  }
}
