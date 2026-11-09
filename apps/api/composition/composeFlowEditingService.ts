import { randomBytes } from "node:crypto";
import { FlowEditingService } from "../../../domains/automations/editing/application/FlowEditingService";
import type { ApiServices } from "./composeBuilderServices";

/** Las piezas del builder que necesita editar un flujo desde fuera del editor. */
export type FlowEditingBuilderServices = Pick<ApiServices, "listAutomationsService" | "getWorkspaceService" | "saveDraftService" | "createAutomationService">;

/**
 * Edición de flujos fuera del editor (agentes por MCP), sobre los MISMOS casos
 * de uso del builder. Ids nuevos como los del editor: `<prefijo>-<aleatorio>`.
 */
export function composeFlowEditingService(builder: FlowEditingBuilderServices): FlowEditingService {
  return new FlowEditingService({
    listAutomations: builder.listAutomationsService,
    getWorkspace: builder.getWorkspaceService,
    saveDraft: builder.saveDraftService,
    createAutomation: builder.createAutomationService,
    ids: { newId: (prefix) => `${prefix}-${randomBytes(6).toString("hex")}` }
  });
}
