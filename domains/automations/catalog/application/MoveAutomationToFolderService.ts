import type { AutomationRepository } from "./AutomationRepository";
import type { FolderRepository } from "./FolderRepository";

/**
 * Mueve una automatización a una carpeta, o la saca de todas.
 *
 * LA RELACIÓN YA EXISTÍA: `AutomationFlow.folderId`. Aquí no se inventa un
 * modelo nuevo ni una tabla de pertenencias; lo único que faltaba era el caso
 * de uso que la cambia.
 *
 * QUÉ COMPRUEBA, Y POR QUÉ CADA COSA:
 *
 *   EL FLUJO EXISTE EN ESTE TENANT   se busca con el tenant por delante, así
 *       que un id de otro tenant no se encuentra y la operación falla. Es lo
 *       que impide que arrastrar mueva algo ajeno.
 *   LA CARPETA EXISTE EN ESTE TENANT  igual. Sin esto, un destino inventado
 *       dejaría el flujo apuntando a una carpeta que nadie puede abrir.
 *   NO SE ESCRIBE SI NO CAMBIA NADA   soltar un flujo en la carpeta donde ya
 *       está no es un movimiento: no toca el disco ni mueve `updatedAt`.
 *
 * `null` como destino significa sacarlo de la carpeta y dejarlo en la raíz. Es
 * un destino legítimo, no una ausencia de destino, y por eso se distingue de
 * `undefined` en el propio tipo.
 */
export class MoveAutomationToFolderService {
  public constructor(
    private readonly automationRepository: AutomationRepository,
    private readonly folderRepository: FolderRepository
  ) {}

  public async execute(tenantId: string, flowId: string, folderId: string | null): Promise<void> {
    const flow = await this.automationRepository.findById(tenantId, flowId);

    if (!flow) {
      throw new Error(`La automatización ${flowId} no existe en este tenant.`);
    }

    if (folderId !== null) {
      const folder = await this.folderRepository.findById(tenantId, folderId);

      if (!folder) {
        throw new Error(`La carpeta ${folderId} no existe en este tenant.`);
      }
    }

    // Ya está donde se la quiere dejar: no hay nada que escribir.
    if ((flow.folderId ?? null) === folderId) return;

    const { folderId: _anterior, ...resto } = flow;

    await this.automationRepository.save({
      ...resto,
      ...(folderId !== null ? { folderId } : {}),
      metadata: { ...flow.metadata, updatedAt: new Date().toISOString() }
    });
  }
}
