import type { Role } from "../../../platform/authorization/contracts/Role";
import type {
  OnboardingPort,
  OnboardingResult
} from "../../../domains/team/application/OnboardingPort";
import type { SqlClient, SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlOnboardingRepository
//
// Responsabilidad única: materializar el alta inicial (tenant + membership)
// como una sola transacción.
//
// El rol inicial es `tenant_owner`: quien crea el espacio es su propietario.
//
// Concurrencia: el SELECT-luego-INSERT de más abajo no basta por sí solo para
// evitar una carrera entre dos peticiones simultáneas del mismo usuario nuevo
// (doble clic, dos pestañas, reintento de red) — ambas pueden ver "no existe"
// y ambas intentar crear el tenant. La key del tenant es determinística
// (`buildTenantKey`), así que la constraint UNIQUE de `tenants.key` impide que
// se cree un tenant duplicado; pero sin capturar ese conflicto, la petición
// perdedora recibiría un 500 en vez del 200 idempotente esperado. Por eso se
// atrapa la violación de esa constraint específica y se relee la membership
// que la petición ganadora acaba de crear.
// ---------------------------------------------------------------------------

const INITIAL_ROLE: Role = "tenant_owner";
const TENANT_KEY_UNIQUE_CONSTRAINT = "tenants_key_unique";
const POSTGRES_UNIQUE_VIOLATION = "23505";

interface ExistingRow {
  readonly tenant_id: string;
  readonly role: string;
  readonly tenant_key: string;
  readonly tenant_name: string;
}

interface CreatedTenantRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

/** Slug legible y único derivado del id de usuario; no es un identificador. */
function buildTenantKey(userId: string): string {
  return `t-${userId.replace(/-/g, "").slice(0, 12)}`;
}

function isTenantKeyConflict(error: unknown): boolean {
  return (
    error != null &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION &&
    (error as { constraint?: unknown }).constraint === TENANT_KEY_UNIQUE_CONSTRAINT
  );
}

function toResult(userId: string, found: ExistingRow, created: boolean): OnboardingResult {
  return {
    tenantId: found.tenant_id,
    tenantKey: found.tenant_key,
    tenantName: found.tenant_name,
    membership: {
      userId,
      tenantId: found.tenant_id,
      role: found.role as Role,
      status: "active"
    },
    created
  };
}

async function selectExisting(sql: SqlExecutor, userId: string): Promise<ExistingRow | undefined> {
  const existing = await sql.query<ExistingRow>(
    `select m.tenant_id, m.role, t.key as tenant_key, t.name as tenant_name
       from memberships m
       join tenants t on t.id = m.tenant_id
      where m.user_id = $1 and m.status = 'active' and t.status = 'active'
      order by t.created_at
      limit 1`,
    [userId]
  );

  return existing.rows[0];
}

export class SqlOnboardingRepository implements OnboardingPort {
  public constructor(private readonly sql: SqlClient) {}

  public async ensureInitialTenant(userId: string, tenantName: string): Promise<OnboardingResult> {
    try {
      return await this.tryCreate(userId, tenantName);
    } catch (error) {
      if (!isTenantKeyConflict(error)) {
        throw error;
      }

      // Otra petición concurrente ganó la carrera y ya creó el tenant/membership.
      // No es un fallo: se relee y se devuelve como si esta petición lo hubiera
      // encontrado ya existente (created: false), igual que el camino normal.
      const found = await selectExisting(this.sql, userId);

      if (!found) {
        // No debería ocurrir: la constraint sólo puede violarse si el tenant de
        // este userId ya existe. Si no aparece, el error original es real.
        throw error;
      }

      return toResult(userId, found, false);
    }
  }

  private async tryCreate(userId: string, tenantName: string): Promise<OnboardingResult> {
    return this.sql.transaction(async (tx) => {
      // Idempotencia: si ya pertenece a algún tenant activo, no se crea nada.
      const found = await selectExisting(tx, userId);

      if (found) {
        return toResult(userId, found, false);
      }

      const tenant = await tx.query<CreatedTenantRow>(
        `insert into tenants (key, name) values ($1, $2) returning id, key, name`,
        [buildTenantKey(userId), tenantName]
      );

      const createdTenant = tenant.rows[0]!;

      await tx.query(
        `insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)`,
        [userId, createdTenant.id, INITIAL_ROLE]
      );

      return toResult(
        userId,
        {
          tenant_id: createdTenant.id,
          role: INITIAL_ROLE,
          tenant_key: createdTenant.key,
          tenant_name: createdTenant.name
        },
        true
      );
    });
  }
}
