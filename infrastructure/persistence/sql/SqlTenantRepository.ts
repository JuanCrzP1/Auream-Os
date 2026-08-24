import type { Tenant, TenantStatus } from "../../../platform/tenancy/contracts/Tenant";
import type { TenantRepository } from "../../../platform/tenancy/application/TenantRepository";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlTenantRepository
//
// Responsabilidad única: leer tenants de PostgreSQL. Sin reglas de negocio.
// ---------------------------------------------------------------------------

interface TenantRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly status: string;
}

function toTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    status: row.status as TenantStatus
  };
}

const SELECT_COLUMNS = "id, key, name, status";

export class SqlTenantRepository implements TenantRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async findById(tenantId: string): Promise<Tenant | null> {
    const result = await this.sql.query<TenantRow>(
      `select ${SELECT_COLUMNS} from tenants where id = $1`,
      [tenantId]
    );

    return result.rows[0] ? toTenant(result.rows[0]) : null;
  }

  public async findByKey(key: string): Promise<Tenant | null> {
    const result = await this.sql.query<TenantRow>(
      `select ${SELECT_COLUMNS} from tenants where key = $1`,
      [key]
    );

    return result.rows[0] ? toTenant(result.rows[0]) : null;
  }
}
