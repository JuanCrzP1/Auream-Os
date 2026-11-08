import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlMediaRepository } from "../../../infrastructure/persistence/sql/SqlMediaRepository";
import { VercelBlobMediaStorage } from "../../../infrastructure/media/VercelBlobMediaStorage";
import { LocalMediaStorage, defaultLocalMediaDirectory } from "../../../infrastructure/media/LocalMediaStorage";
import { InMemoryRateLimiter } from "../../../platform/security/rate-limiting/application/InMemoryRateLimiter";
import { CreateMediaUploadService, RegisterMediaService } from "../../../domains/media/application/MediaServices";

// ---------------------------------------------------------------------------
// composeMediaServices — el ÚNICO punto que elige dónde viven los medios:
//
//   BLOB_READ_WRITE_TOKEN   → Vercel Blob (producción y vistas previas)
//   sin él, en desarrollo   → carpeta local `data/media`, servida por la API
//   sin él, en producción   → no hay medios (la API responde 503; el build de
//                             producción ya exige el token)
// ---------------------------------------------------------------------------

export interface MediaServices {
  readonly createUpload: CreateMediaUploadService;
  readonly register: RegisterMediaService;
  /** Solo en desarrollo: recibe subidas y sirve archivos. */
  readonly local: LocalMediaStorage | null;
}

export function composeMediaServices(config: ApiConfig, sqlClient: SqlClient): MediaServices | null {
  const local = !config.blobReadWriteToken && !config.isProduction ? new LocalMediaStorage(defaultLocalMediaDirectory(), config.publicApiBaseUrl) : null;
  const storage = config.blobReadWriteToken ? new VercelBlobMediaStorage(config.blobReadWriteToken) : local;
  if (!storage) return null;

  return {
    createUpload: new CreateMediaUploadService(storage, new InMemoryRateLimiter()),
    register: new RegisterMediaService(new SqlMediaRepository(sqlClient), storage),
    local
  };
}
