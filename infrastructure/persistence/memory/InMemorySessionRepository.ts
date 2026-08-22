import type { SessionRepository } from "../../../domains/sessions/application/SessionRepository";
import type { Session } from "../../../contracts/RuntimeContracts";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();
  private static readonly MAX_SESSIONS = 10_000;

  public find(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public save(session: Session): void {
    if (!this.sessions.has(session.id) && this.sessions.size >= InMemorySessionRepository.MAX_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey !== undefined) {
        this.sessions.delete(oldestKey);
      }
    }
    this.sessions.set(session.id, session);
  }
}
