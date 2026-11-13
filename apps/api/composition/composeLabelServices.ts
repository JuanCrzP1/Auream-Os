import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import type { ContactRepository, LabelRepository } from "../../../domains/contacts/application/ContactRepository";
import { LabelManagementServices } from "../../../domains/labels/application/LabelManagementServices";
import type { LabelFlows, LabelMergeQueue } from "../../../domains/labels/application/LabelManagementPorts";
import { LabelMergeRunner } from "../../../domains/labels/application/LabelMergeRunner";
import { renameLabelInFlow } from "../../../domains/labels/domain/flowLabels";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import { PermanentTaskError, type ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlLabelMerges } from "../../../infrastructure/persistence/sql/SqlLabelMerges";
import { SqlLabelReferences } from "../../../infrastructure/persistence/sql/SqlLabelReferences";

// ---------------------------------------------------------------------------
// Etiquetas (Configuración › Datos › Etiquetas): quién usa cada una, cambiarle
// el nombre en los flujos que la nombran y unir una en otra. Los clientes
// pasan por el repositorio de Contactos con sus reglas (las etapas del CRM y
// su historial), por tandas en la cola de tareas (`labels.merge`).
// ---------------------------------------------------------------------------

export const LABEL_MERGE_TASK_KIND = "labels.merge";
const MAX_ATTEMPTS = 5;

export interface LabelDependencies {
  readonly sql: SqlClient;
  readonly labels: LabelRepository;
  /** El repositorio de Contactos CON sus reglas de etiquetas (las etapas del CRM). */
  readonly contacts: Pick<ContactRepository, "changeLabels">;
  readonly automations: Pick<AutomationRepository, "findByTenant">;
  readonly workspaces: Pick<BuilderWorkspaceRepository, "getWorkspaces">;
  readonly saveDraft: Pick<SaveDraftService, "execute">;
  readonly scheduler: Pick<TaskScheduler, "schedule">;
}

export interface LabelModule {
  readonly services: LabelManagementServices;
  readonly handler: TaskHandler;
}

/** Los flujos que corren (los archivados no): leerlos y cambiar el nombre como un guardado del editor. Un flujo ocupado se reporta. */
function labelFlows(deps: LabelDependencies): LabelFlows {
  const live = async (tenantId: string) => {
    const flows = (await deps.automations.findByTenant(tenantId)).filter((flow) => flow.status !== "archived");
    return flows.length === 0 ? [] : deps.workspaces.getWorkspaces(tenantId, flows.map((flow) => flow.key));
  };
  return {
    drafts: async (tenantId) => (await live(tenantId)).map((workspace) => workspace.draft),
    rename: async (tenantId, rename) => {
      const skipped: string[] = [];
      for (const workspace of await live(tenantId)) {
        const result = renameLabelInFlow(workspace.draft, rename);
        if (result.changed === 0) continue;
        try {
          await deps.saveDraft.execute(workspace, result.draft);
        } catch {
          skipped.push(workspace.draft.flow.name);
        }
      }
      return skipped;
    }
  };
}

export function composeLabelServices(deps: LabelDependencies): LabelModule {
  const merges = new SqlLabelMerges(deps.sql);
  const queue: LabelMergeQueue = {
    next: async (tenantId, mergeId, round) => {
      await deps.scheduler.schedule({
        tenantId,
        kind: LABEL_MERGE_TASK_KIND,
        groupKey: `labels-merge:${mergeId}`,
        dedupeKey: `${LABEL_MERGE_TASK_KIND}:${mergeId}:${round}`,
        payload: { mergeId, round },
        dueAt: new Date(),
        maxAttempts: MAX_ATTEMPTS
      });
    }
  };
  const runner = new LabelMergeRunner(
    merges,
    {
      holders: (tenantId, labelId, limit) => merges.holders(tenantId, labelId, limit),
      move: (tenantId, contactId, fromId, intoId, note) => deps.contacts.changeLabels(tenantId, contactId, { add: [intoId], remove: [fromId] }, { kind: "auto", note })
    },
    deps.labels,
    queue
  );
  return {
    services: new LabelManagementServices(deps.labels, new SqlLabelReferences(deps.sql), labelFlows(deps), merges, merges, queue),
    handler: {
      kind: LABEL_MERGE_TASK_KIND,
      handle: async (task: ScheduledTask) => {
        const mergeId = task.payload["mergeId"];
        const round = Number(task.payload["round"] ?? 0);
        if (typeof mergeId !== "string" || !mergeId) throw new PermanentTaskError("La tarea no dice qué unión seguir.");
        try {
          await runner.run(task.tenantId, mergeId, round);
        } catch (error) {
          // En el último intento queda anotada como fallida (lo ya pasado se queda pasado).
          if (task.attempts >= (task.maxAttempts || MAX_ATTEMPTS)) await runner.fail(task.tenantId, mergeId, error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    }
  };
}
