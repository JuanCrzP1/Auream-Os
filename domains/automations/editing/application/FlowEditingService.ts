import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { FlowReview } from "../../../../contracts/blocks/reviewFlow";
import { ConflictError } from "../../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import type { AutomationFlow } from "../../catalog/domain/AutomationFlow";
import type { CreateAutomationService } from "../../builder/application/CreateAutomationService";
import type { GetBuilderWorkspaceService } from "../../builder/application/GetBuilderWorkspaceService";
import type { SaveDraftService } from "../../builder/application/SaveDraftService";
import type { ListAutomationsService } from "../../catalog/application/ListAutomationsService";
import { reviewDraft } from "../domain/draftGraph";
import type { EditIds, EditResult } from "../domain/FlowDraftEditor";

// ---------------------------------------------------------------------------
// Editar un flujo desde fuera del editor (hoy: agentes de IA por MCP) con las
// MISMAS piezas que usa el editor: el borrador se lee y se guarda con
// `GetBuilderWorkspaceService` y `SaveDraftService` (bloqueo optimista
// incluido) y los cambios son las operaciones de `FlowDraftEditor`.
//
// Los flujos no se publican: lo guardado es lo que corre. Por eso cada cambio
// se valida antes de guardar, se guarda entero o no se guarda, y devuelve la
// revisión del flujo (lo que el usuario vería en «Revisión del flujo»).
//
// Si alguien guardó a la vez (el editor abierto, otro agente), se vuelve a
// leer y se reintenta una vez sobre la versión nueva: nunca se pisa su trabajo.
// ---------------------------------------------------------------------------

export interface FlowEditingDependencies {
  readonly listAutomations: Pick<ListAutomationsService, "execute">;
  readonly getWorkspace: Pick<GetBuilderWorkspaceService, "execute">;
  readonly saveDraft: Pick<SaveDraftService, "execute">;
  readonly createAutomation: Pick<CreateAutomationService, "execute">;
  readonly ids: EditIds;
}

/** Un flujo después de un cambio: su borrador guardado, la revisión y el detalle de la operación. */
export interface FlowEdited<T> {
  readonly flow: Pick<AutomationFlow, "id" | "key" | "name" | "status">;
  readonly draft: BuilderFlowSnapshot;
  readonly review: FlowReview;
  readonly detail: Omit<T, "draft">;
}

export type DraftOperation<T> = (draft: BuilderFlowSnapshot, ids: EditIds) => EditResult<T>;

const MAX_FLOW_NAME = 80;

function requireFlowName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new ValidationError("Ponle un nombre al flujo.");
  if (name.length > MAX_FLOW_NAME) throw new ValidationError(`El nombre del flujo admite hasta ${MAX_FLOW_NAME} caracteres.`);
  return name;
}

export class FlowEditingService {
  public constructor(private readonly deps: FlowEditingDependencies) {}

  /** Busca el flujo por id o clave (lo que devuelve list_flows). */
  public async findFlow(tenantId: string, flowRef: string): Promise<AutomationFlow> {
    const { flows } = await this.deps.listAutomations.execute(tenantId);
    const flow = flows.map((item) => item.flow).find((item) => item.id === flowRef || item.key === flowRef);
    if (!flow) throw new NotFoundError("Ese flujo no existe en la cuenta. Usa list_flows para ver los ids.");
    return flow;
  }

  /** El borrador actual y su revisión, sin cambiar nada. */
  public async read(tenantId: string, flowRef: string): Promise<FlowEdited<object>> {
    const flow = await this.findFlow(tenantId, flowRef);
    const workspace = await this.deps.getWorkspace.execute(tenantId, flow.key);
    if (!workspace) throw new NotFoundError("Ese flujo no existe en la cuenta.");
    return { flow: summary(flow), draft: workspace.draft, review: reviewDraft(workspace.draft), detail: {} };
  }

  /** Un flujo nuevo (nace solo con el bloque de inicio), en la carpeta indicada si se da. */
  public async createFlow(tenantId: string, request: { readonly name: unknown; readonly folderId?: string }): Promise<FlowEdited<object>> {
    const flow = await this.deps.createAutomation.execute(tenantId, { name: requireFlowName(request.name), ...(request.folderId ? { folderId: request.folderId } : {}) });
    return this.read(tenantId, flow.id);
  }

  public async renameFlow(tenantId: string, flowRef: string, name: unknown): Promise<FlowEdited<object>> {
    const next = requireFlowName(name);
    return this.edit(tenantId, flowRef, (draft) => ({ draft: { ...draft, flow: { ...draft.flow, name: next } } }));
  }

  /** Aplica una operación al borrador y lo guarda (reintenta una vez si alguien guardó a la vez). */
  public async edit<T>(tenantId: string, flowRef: string, operation: DraftOperation<T>): Promise<FlowEdited<T>> {
    const flow = await this.findFlow(tenantId, flowRef);
    try {
      return await this.applyAndSave(tenantId, flow, operation);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      return this.applyAndSave(tenantId, flow, operation);
    }
  }

  private async applyAndSave<T>(tenantId: string, flow: AutomationFlow, operation: DraftOperation<T>): Promise<FlowEdited<T>> {
    const workspace = await this.deps.getWorkspace.execute(tenantId, flow.key);
    if (!workspace) throw new NotFoundError("Ese flujo no existe en la cuenta.");
    const { draft, ...detail } = operation(workspace.draft, this.deps.ids);
    const saved = await this.deps.saveDraft.execute(workspace, draft, { baseRevision: workspace.autosaveRevision });
    return { flow: { ...summary(flow), name: saved.draft.flow.name }, draft: saved.draft, review: reviewDraft(saved.draft), detail };
  }
}

function summary(flow: AutomationFlow): FlowEdited<object>["flow"] {
  return { id: flow.id, key: flow.key, name: flow.name, status: flow.status };
}
