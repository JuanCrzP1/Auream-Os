import type { FolderRepository } from "./FolderRepository";

/**
 * Renombra una carpeta.
 *
 * Existe porque el catálogo sabía crear carpetas pero no cambiarles el nombre:
 * el puerto ya lo permitía —`findById` y `save`— y no había ningún caso de uso
 * que lo usara.
 *
 * QUÉ COMPRUEBA:
 *
 *   LA CARPETA EXISTE EN ESTE TENANT   se busca con el tenant por delante, así
 *       que un id de otro tenant no se encuentra. Es lo mismo que hace mover
 *       una automatización, y por el mismo motivo.
 *   EL NOMBRE DICE ALGO                un nombre en blanco no identifica nada
 *       y dejaría una carpeta imposible de reconocer en el hub.
 *   NO SE ESCRIBE SI NO CAMBIA NADA    confirmar el mismo nombre no es un
 *       cambio: no toca el disco.
 *
 * Se recorta el nombre aquí y no en la interfaz: es la regla del dominio, y
 * dejarla en el formulario significaría que otro cliente de la API podría
 * guardar espacios por delante.
 */
export class RenameFolderService {
  public constructor(private readonly folderRepository: FolderRepository) {}

  public async execute(tenantId: string, folderId: string, name: string): Promise<void> {
    const nombre = name.trim();

    if (nombre.length === 0) {
      throw new Error("El nombre de la carpeta no puede estar vacío.");
    }

    const folder = await this.folderRepository.findById(tenantId, folderId);

    if (!folder) {
      throw new Error(`La carpeta ${folderId} no existe en este tenant.`);
    }

    if (folder.name === nombre) return;

    await this.folderRepository.save({ ...folder, name: nombre });
  }
}
