import type {
  AutomationFolderSummary,
  AutomationListResponse,
  AutomationSummary
} from "../../../contracts/AutomationContracts";
import type { AutomationFlow } from "../../../domains/automations/catalog/domain/AutomationFlow";
import type { AutomationFolder } from "../../../domains/automations/catalog/domain/AutomationFolder";

// ---------------------------------------------------------------------------
// Traducción de entidades de dominio de Automations a su representación HTTP.
//
// Responsabilidad única: ser el ÚNICO punto donde la forma interna
// (`tenantId`, `metadata` anidada) se convierte en la forma pública
// (`AutomationSummary`, con `updatedAt` y `tags` en raíz).
//
// Sin este punto único, cada handler inventaría su propia forma y el frontend
// tendría que adivinarla — que es exactamente el defecto que esto corrige.
// ---------------------------------------------------------------------------

export function toAutomationSummary(flow: AutomationFlow): AutomationSummary {
  return {
    id: flow.id,
    key: flow.key,
    name: flow.name,
    status: flow.status,
    ...(flow.folderId !== undefined ? { folderId: flow.folderId } : {}),
    updatedAt: flow.metadata.updatedAt,
    ...(flow.metadata.tags !== undefined ? { tags: flow.metadata.tags } : {})
  };
}

export function toAutomationFolderSummary(folder: AutomationFolder): AutomationFolderSummary {
  return {
    id: folder.id,
    name: folder.name,
    ...(folder.parentFolderId !== undefined ? { parentFolderId: folder.parentFolderId } : {})
  };
}

export function toAutomationListResponse(result: {
  flows: AutomationFlow[];
  folders: AutomationFolder[];
}): AutomationListResponse {
  return {
    flows: result.flows.map(toAutomationSummary),
    folders: result.folders.map(toAutomationFolderSummary)
  };
}
