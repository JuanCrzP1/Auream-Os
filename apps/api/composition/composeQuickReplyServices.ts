import { QuickReplyServices } from "../../../domains/quick-replies/application/QuickReplyServices";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlQuickReplyRepository } from "../../../infrastructure/persistence/sql/SqlQuickReplyRepository";

// composeQuickReplyServices — las respuestas rápidas del chat, en PostgreSQL.
export function composeQuickReplyServices(sql: SqlClient): QuickReplyServices {
  return new QuickReplyServices(new SqlQuickReplyRepository(sql));
}
