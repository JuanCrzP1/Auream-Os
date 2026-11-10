import type { Company, CompanyChanges } from "../../../domains/company/domain/Company";
import type { CompanyRepository } from "../../../domains/company/application/CompanyRepository";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlCompanyRepository — la empresa sobre `tenants` (nombre, zona horaria y
// logo, 028). Sin reglas de negocio: valida el dominio.
// ---------------------------------------------------------------------------

interface CompanyRow {
  readonly id: string;
  readonly name: string;
  readonly timezone: string | null;
  readonly logo_pathname: string | null;
  readonly logo_url: string | null;
}

const COLUMNS = "id, name, timezone, logo_pathname, logo_url";

function toCompany(row: CompanyRow): Company {
  return { tenantId: row.id, name: row.name, timezone: row.timezone, logoPathname: row.logo_pathname, logoUrl: row.logo_url };
}

export class SqlCompanyRepository implements CompanyRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(tenantId: string): Promise<Company | null> {
    const result = await this.sql.query<CompanyRow>(`select ${COLUMNS} from tenants where id = $1`, [tenantId]);
    return result.rows[0] ? toCompany(result.rows[0]) : null;
  }

  public async update(tenantId: string, changes: CompanyChanges): Promise<Company | null> {
    const sets: string[] = [];
    const params: unknown[] = [tenantId];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (changes.name !== undefined) set("name", changes.name);
    if (changes.timezone !== undefined) set("timezone", changes.timezone);
    if (changes.logo !== undefined) {
      set("logo_pathname", changes.logo?.pathname ?? null);
      set("logo_url", changes.logo?.url ?? null);
    }
    if (sets.length === 0) return this.find(tenantId);

    const result = await this.sql.query<CompanyRow>(
      `update tenants set ${sets.join(", ")}, updated_at = now() where id = $1 returning ${COLUMNS}`,
      params
    );
    return result.rows[0] ? toCompany(result.rows[0]) : null;
  }
}
