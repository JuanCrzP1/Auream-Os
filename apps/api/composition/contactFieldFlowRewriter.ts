import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { FlowRewriter } from "../../../domains/contact-fields/application/ContactFieldToolPorts";
import { renameFlowKeys, restoreFlowBlocks, type BlockChange } from "../../../domains/contact-fields/domain/fieldMerge";

// ---------------------------------------------------------------------------
// Unir campos → los flujos de la cuenta: cambia la clave en los bloques de
// cada flujo que corre (los archivados no) y lo guarda como cualquier
// guardado del editor (misma revisión, mismo candado). Un flujo que no se
// pudo guardar (alguien lo estaba editando) se reporta por su nombre: no se
// pisa su trabajo.
// ---------------------------------------------------------------------------

export interface FlowRewriterDependencies {
  readonly automations: Pick<AutomationRepository, "findByTenant">;
  readonly workspaces: Pick<BuilderWorkspaceRepository, "getWorkspaces">;
  readonly saveDraft: Pick<SaveDraftService, "execute">;
}

export function contactFieldFlowRewriter(deps: FlowRewriterDependencies): FlowRewriter {
  const live = async (tenantId: string) => {
    const flows = (await deps.automations.findByTenant(tenantId)).filter((flow) => flow.status !== "archived");
    return flows.length === 0 ? [] : deps.workspaces.getWorkspaces(tenantId, flows.map((flow) => flow.key));
  };

  return {
    rename: async (tenantId, rename) => {
      const changes: BlockChange[] = [];
      const skipped: string[] = [];
      for (const workspace of await live(tenantId)) {
        const result = renameFlowKeys(workspace.draft, rename);
        if (result.changes.length === 0) continue;
        try {
          await deps.saveDraft.execute(workspace, result.draft);
          changes.push(...result.changes);
        } catch {
          skipped.push(workspace.draft.flow.name);
        }
      }
      return { changes, skipped };
    },

    restore: async (tenantId, changes) => {
      const byFlow = new Map<string, BlockChange[]>();
      for (const change of changes) byFlow.set(change.flowKey, [...(byFlow.get(change.flowKey) ?? []), change]);
      const workspaces = new Map((await live(tenantId)).map((workspace) => [workspace.flowKey, workspace]));
      let skipped = 0;
      for (const [flowKey, blocks] of byFlow) {
        const workspace = workspaces.get(flowKey);
        if (!workspace) {
          skipped += blocks.length;
          continue;
        }
        const result = restoreFlowBlocks(workspace.draft, blocks);
        skipped += result.skipped;
        if (result.restored === 0) continue;
        try {
          await deps.saveDraft.execute(workspace, result.draft);
        } catch {
          skipped += result.restored;
        }
      }
      return { skipped };
    }
  };
}
