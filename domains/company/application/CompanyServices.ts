import type { CompanyResponse, ConfirmImageRequest, ImageUploadRequest, UpdateCompanyRequest } from "../../../contracts/AccountContracts";
import type { MediaUploadTicket } from "../../../contracts/MediaContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import type { ImageUploads } from "../../media/application/ImageUploads";
import { companyLogoFolder, normalizeCompanyName, normalizeTimeZone, type Company, type CompanyChanges } from "../domain/Company";
import type { CompanyRepository } from "./CompanyRepository";

// ---------------------------------------------------------------------------
// Empresa: ver y cambiar el nombre, la zona horaria y el logo de la cuenta.
// Quién puede cambiarla lo decide la ruta (`tenant.manage`); aquí solo se
// validan los datos. El `tenantId` sale siempre del contexto verificado.
// ---------------------------------------------------------------------------

export class CompanyServices {
  public constructor(
    private readonly repository: CompanyRepository,
    /** `null` sin almacén de archivos: no hay logos (la API responde 503). */
    private readonly images: ImageUploads | null,
    private readonly defaultTimezone: string
  ) {}

  public get canUploadLogos(): boolean {
    return this.images !== null;
  }

  public async get(tenantId: string, canEdit: boolean): Promise<CompanyResponse> {
    return this.toResponse(await this.load(tenantId), canEdit);
  }

  public async update(tenantId: string, input: Partial<UpdateCompanyRequest>): Promise<CompanyResponse> {
    const changes: CompanyChanges = {
      ...(input.name !== undefined ? { name: normalizeCompanyName(input.name) } : {}),
      ...(input.timezone !== undefined ? { timezone: normalizeTimeZone(input.timezone) } : {})
    };
    return this.toResponse(await this.apply(tenantId, changes), true);
  }

  public logoTicket(tenantId: string, input: Partial<ImageUploadRequest>): Promise<MediaUploadTicket> {
    return this.requireImages().ticket(companyLogoFolder(tenantId), `tenant:${tenantId}`, input);
  }

  public async setLogo(tenantId: string, input: Partial<ConfirmImageRequest>): Promise<CompanyResponse> {
    const images = this.requireImages();
    const folder = companyLogoFolder(tenantId);
    const logo = await images.confirm(folder, input.pathname);
    const before = await this.load(tenantId);
    const after = await this.apply(tenantId, { logo });
    if (before.logoPathname !== logo.pathname) await images.discard(folder, before.logoPathname);
    return this.toResponse(after, true);
  }

  public async removeLogo(tenantId: string): Promise<CompanyResponse> {
    const before = await this.load(tenantId);
    if (!before.logoPathname) return this.toResponse(before, true);
    const after = await this.apply(tenantId, { logo: null });
    await this.images?.discard(companyLogoFolder(tenantId), before.logoPathname);
    return this.toResponse(after, true);
  }

  private toResponse(company: Company, canEdit: boolean): CompanyResponse {
    return {
      name: company.name,
      timezone: company.timezone ?? this.defaultTimezone,
      timezoneIsDefault: company.timezone === null,
      logoUrl: company.logoUrl,
      canEdit
    };
  }

  private async load(tenantId: string): Promise<Company> {
    const company = await this.repository.find(tenantId);
    if (!company) throw new NotFoundError("La empresa no existe.");
    return company;
  }

  private async apply(tenantId: string, changes: CompanyChanges): Promise<Company> {
    const company = await this.repository.update(tenantId, changes);
    if (!company) throw new NotFoundError("La empresa no existe.");
    return company;
  }

  private requireImages(): ImageUploads {
    if (!this.images) throw new Error("No hay almacén de archivos para los logos.");
    return this.images;
  }
}
