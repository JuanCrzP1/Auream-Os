import type { MediaAsset } from "../domain/MediaAsset";

export interface MediaRepository {
  findById(tenantId: string, id: string): Promise<MediaAsset | null>;
  /** Inserta. Si ese id ya existe en la cuenta, no hace nada (registrar es idempotente). */
  save(asset: MediaAsset): Promise<void>;
}
