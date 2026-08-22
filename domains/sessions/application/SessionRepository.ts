import type { Session } from "../../../contracts/RuntimeContracts";

export interface SessionRepository {
  find(sessionId: string): Session | undefined;
  save(session: Session): void;
}
