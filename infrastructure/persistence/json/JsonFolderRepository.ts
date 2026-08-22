import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { FolderRepository } from "../../../domains/automations/catalog/application/FolderRepository";
import type { AutomationFolder } from "../../../domains/automations/catalog/domain/AutomationFolder";

/**
 * JsonFolderRepository — implementación filesystem de FolderRepository.
 *
 * Persiste cada carpeta como un fichero JSON en:
 *   {rootDirectory}/{tenantId}/folders/{folderId}.json
 *
 * Sólo para desarrollo local. En producción, reemplazar por implementación
 * de base de datos sin cambiar la interfaz ni los servicios de aplicación.
 */
export class JsonFolderRepository implements FolderRepository {
  public constructor(private readonly rootDirectory: string) {}

  public async findByTenant(tenantId: string): Promise<AutomationFolder[]> {
    const dir = this.tenantDir(tenantId);
    try {
      const entries = await readdir(dir);
      const jsonFiles = entries.filter((f) => f.endsWith(".json"));
      const results = await Promise.all(
        jsonFiles.map((file) => this.readFolder(join(dir, file)))
      );
      return results.filter((f): f is AutomationFolder => f !== null);
    } catch (err) {
      if (this.isNotFound(err)) return [];
      throw err;
    }
  }

  public async findById(tenantId: string, id: string): Promise<AutomationFolder | undefined> {
    const filePath = this.folderPath(tenantId, id);
    const folder = await this.readFolder(filePath);
    return folder ?? undefined;
  }

  public async save(folder: AutomationFolder): Promise<void> {
    const filePath = this.folderPath(folder.tenantId, folder.id);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(folder, null, 2), "utf-8");
  }

  private async readFolder(filePath: string): Promise<AutomationFolder | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as AutomationFolder;
    } catch (err) {
      if (this.isNotFound(err)) return null;
      throw err;
    }
  }

  private tenantDir(tenantId: string): string {
    return join(this.rootDirectory, tenantId, "folders");
  }

  private folderPath(tenantId: string, id: string): string {
    return join(this.tenantDir(tenantId), `${id}.json`);
  }

  private isNotFound(err: unknown): boolean {
    return err instanceof Error && "code" in err && err.code === "ENOENT";
  }
}
