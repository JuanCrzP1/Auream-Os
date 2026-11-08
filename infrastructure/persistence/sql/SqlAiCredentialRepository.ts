import type { AiCredentialRepository } from "../../../domains/integrations/application/AiCredentialRepository";
import type { AiCredential } from "../../../domains/integrations/domain/AiCredential";
import type { AiCredentialStatus, AiProviderId } from "../../../contracts/AiContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

interface Row {
  id: string;
  tenant_id: string;
  provider: AiProviderId;
  name: string;
  secret: string;
  secret_hint: string;
  status: AiCredentialStatus;
  last_verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, tenant_id, provider, name, secret, secret_hint, status, last_verified_at, created_at, updated_at";

function toCredential(row: Row): AiCredential {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider,
    name: row.name,
    secret: row.secret,
    hint: row.secret_hint,
    status: row.status,
    lastVerifiedAt: row.last_verified_at === null ? null : toIso(row.last_verified_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/** Conexiones de IA en PostgreSQL (`007_ai_credentials.sql`). Todo filtra por cuenta. */
export class SqlAiCredentialRepository implements AiCredentialRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async listByTenant(tenantId: string): Promise<AiCredential[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>(`select ${COLUMNS} from ai_credentials where tenant_id = $1 order by created_at`, [tenantId]);
    return result.rows.map(toCredential);
  }

  public async findById(tenantId: string, id: string): Promise<AiCredential | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from ai_credentials where tenant_id = $1 and id = $2`, [tenantId, id]);
    return result.rows[0] ? toCredential(result.rows[0]) : null;
  }

  public async save(credential: AiCredential): Promise<void> {
    try {
      await this.sql.query(
        `insert into ai_credentials (${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set
           name = excluded.name, secret = excluded.secret, secret_hint = excluded.secret_hint,
           status = excluded.status, last_verified_at = excluded.last_verified_at, updated_at = excluded.updated_at
         where ai_credentials.tenant_id = excluded.tenant_id`,
        [
          credential.id, credential.tenantId, credential.provider, credential.name, credential.secret, credential.hint,
          credential.status, credential.lastVerifiedAt, credential.createdAt, credential.updatedAt
        ]
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "23505") {
        throw new ConflictError(`Ya tienes una conexión de IA llamada «${credential.name}».`);
      }
      throw error;
    }
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from ai_credentials where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }
}
