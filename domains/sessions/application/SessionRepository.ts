import type { Session } from "../../../contracts/RuntimeContracts";

export interface SessionRepository {
  find(sessionId: string): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}
