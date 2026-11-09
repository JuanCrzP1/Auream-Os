import type { ConversationLock } from "../../../domains/messaging/application/ports/MessagingPorts";
import type { SqlClient } from "./SqlClient";

/**
 * Un mensaje por conversación a la vez, en cualquier instancia de la función:
 * candado consultivo de PostgreSQL atado a una transacción, que se libera
 * solo al terminar (o si la instancia muere). Las demás conversaciones no esperan.
 */
export class SqlConversationLock implements ConversationLock {
  public constructor(private readonly sql: SqlClient) {}

  public withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    return this.sql.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`conversation:${key}`]);
      return work();
    });
  }
}
