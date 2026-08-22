import type { AutomationStatus } from "../../../../contracts/AutomationContracts";
import type { AutomationMetadata } from "./AutomationMetadata";

/**
 * Entidad de dominio de un flow del catálogo.
 *
 * Incluye `tenantId` y agrupa las fechas bajo `metadata`: son datos internos.
 * La forma que cruza HTTP es `AutomationSummary` en `contracts/`.
 */
export interface AutomationFlow {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  status: AutomationStatus;
  folderId?: string;
  metadata: AutomationMetadata;
}
