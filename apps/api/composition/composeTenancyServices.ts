import { createSqlClient, type SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlMembershipRepository } from "../../../infrastructure/persistence/sql/SqlMembershipRepository";
import { SqlOnboardingRepository } from "../../../infrastructure/persistence/sql/SqlOnboardingRepository";
import { SqlTenantRepository } from "../../../infrastructure/persistence/sql/SqlTenantRepository";
import type { MembershipRepository } from "../../../domains/team/application/MembershipRepository";
import type { OnboardingPort } from "../../../domains/team/application/OnboardingPort";
import type { TenantRepository } from "../../../platform/tenancy/application/TenantRepository";
import type { DatabaseConfig } from "../config/loadDatabaseConfig";

// ---------------------------------------------------------------------------
// composeTenancyServices
//
// Responsabilidad única: ensamblar la persistencia de tenancy.
//
// Es el ÚNICO punto que elige la implementación SQL. Sustituirla no requiere
// tocar ningún archivo de `domains/` ni de `platform/`.
// ---------------------------------------------------------------------------

export interface TenancyServices {
  readonly sqlClient: SqlClient;
  readonly tenantRepository: TenantRepository;
  readonly membershipRepository: MembershipRepository;
  readonly onboarding: OnboardingPort;
}

export function composeTenancyServices(config: DatabaseConfig): TenancyServices {
  const sqlClient = createSqlClient(config.connectionString);

  return {
    sqlClient,
    tenantRepository: new SqlTenantRepository(sqlClient),
    membershipRepository: new SqlMembershipRepository(sqlClient),
    onboarding: new SqlOnboardingRepository(sqlClient)
  };
}
