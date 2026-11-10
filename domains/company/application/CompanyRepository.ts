import type { Company, CompanyChanges } from "../domain/Company";

// ---------------------------------------------------------------------------
// CompanyRepository — puerto. La implementación SQL (tabla `tenants`) vive en
// `infrastructure/persistence/sql/SqlCompanyRepository.ts`.
// ---------------------------------------------------------------------------

export interface CompanyRepository {
  find(tenantId: string): Promise<Company | null>;
  /** Aplica solo lo que viene en `changes`; devuelve la empresa resultante (o `null` si no existe). */
  update(tenantId: string, changes: CompanyChanges): Promise<Company | null>;
}
