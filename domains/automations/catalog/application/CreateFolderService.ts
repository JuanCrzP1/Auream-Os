import type { FolderRepository } from "./FolderRepository";
import type { AutomationFolder } from "../domain/AutomationFolder";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";

/**
 * CreateFolderService — caso de uso: crear una carpeta en un tenant.
 *
 * Aquí vive la invariante "una carpeta tiene nombre": no en el handler HTTP ni
 * en el formulario. Cualquier entrada futura (otra ruta, un importador, una
 * migración) obtiene la misma regla sin volver a escribirla.
 *
 * El nombre se normaliza aquí por el mismo motivo: el dominio decide qué
 * considera "el mismo nombre", no el transporte.
 */
export class CreateFolderService {
  constructor(private readonly folderRepo: FolderRepository) {}

  async execute(tenantId: string, name: string, parentFolderId?: string): Promise<AutomationFolder> {
    const normalized = name.trim();

    if (normalized.length === 0) {
      throw new ValidationError("El nombre de la carpeta es obligatorio");
    }

    const folder: AutomationFolder = {
      id: crypto.randomUUID(),
      tenantId,
      name: normalized,
      parentFolderId,
      createdAt: new Date().toISOString()
    };
    await this.folderRepo.save(folder);
    return folder;
  }
}
