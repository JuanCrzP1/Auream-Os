import type { MediaRepository } from "../../../domains/media/application/MediaRepository";
import type { MediaAsset } from "../../../domains/media/domain/MediaAsset";

/** Medios en memoria (tests). */
export class InMemoryMediaRepository implements MediaRepository {
  public readonly items: MediaAsset[] = [];

  public async findById(tenantId: string, id: string): Promise<MediaAsset | null> {
    return this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null;
  }

  public async save(asset: MediaAsset): Promise<void> {
    if (!this.items.some((item) => item.id === asset.id)) this.items.push(asset);
  }
}
