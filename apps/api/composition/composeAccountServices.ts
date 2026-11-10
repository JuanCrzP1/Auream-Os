import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import type { MediaStorage } from "../../../domains/media/application/ports/MediaStorage";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import { ImageUploads } from "../../../domains/media/application/ImageUploads";
import { ProfileServices } from "../../../domains/profiles/application/ProfileServices";
import { CompanyServices } from "../../../domains/company/application/CompanyServices";
import { SqlUserProfileRepository } from "../../../infrastructure/persistence/sql/SqlUserProfileRepository";
import { SqlCompanyRepository } from "../../../infrastructure/persistence/sql/SqlCompanyRepository";

// ---------------------------------------------------------------------------
// composeAccountServices — Mi perfil y Empresa, en Neon. Las fotos y logos van
// al mismo almacén que los medios (`composeMediaServices` lo elige); sin
// almacén, todo funciona salvo subir imágenes (503).
// ---------------------------------------------------------------------------

export interface AccountServices {
  readonly profiles: ProfileServices;
  readonly company: CompanyServices;
}

export function composeAccountServices(config: ApiConfig, sql: SqlClient, storage: MediaStorage | null, rateLimiter: RateLimiter): AccountServices {
  const images = storage ? new ImageUploads(storage, rateLimiter) : null;
  return {
    profiles: new ProfileServices(new SqlUserProfileRepository(sql), images),
    company: new CompanyServices(new SqlCompanyRepository(sql), images, config.defaultTimezone)
  };
}
