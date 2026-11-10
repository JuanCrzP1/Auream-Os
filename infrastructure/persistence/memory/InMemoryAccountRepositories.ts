import type { UserProfile } from "../../../domains/profiles/domain/UserProfile";
import type { UserProfileRepository } from "../../../domains/profiles/application/UserProfileRepository";
import type { Company, CompanyChanges } from "../../../domains/company/domain/Company";
import type { CompanyRepository } from "../../../domains/company/application/CompanyRepository";

// ---------------------------------------------------------------------------
// Perfiles y empresas en memoria: pruebas y desarrollo sin base de datos.
// ---------------------------------------------------------------------------

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private readonly profiles = new Map<string, UserProfile>();

  public async find(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  public async save(profile: UserProfile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }
}

export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly companies = new Map<string, Company>();

  public constructor(seed: ReadonlyArray<Company> = []) {
    for (const company of seed) this.companies.set(company.tenantId, company);
  }

  public async find(tenantId: string): Promise<Company | null> {
    return this.companies.get(tenantId) ?? null;
  }

  public async update(tenantId: string, changes: CompanyChanges): Promise<Company | null> {
    const current = this.companies.get(tenantId);
    if (!current) return null;
    const next: Company = {
      ...current,
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.timezone !== undefined ? { timezone: changes.timezone } : {}),
      ...(changes.logo !== undefined ? { logoPathname: changes.logo?.pathname ?? null, logoUrl: changes.logo?.url ?? null } : {})
    };
    this.companies.set(tenantId, next);
    return next;
  }
}
