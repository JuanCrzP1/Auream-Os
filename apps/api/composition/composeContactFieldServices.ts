import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import { ContactFieldServices } from "../../../domains/contact-fields/application/ContactFieldServices";
import { ContactFieldSync } from "../../../domains/contact-fields/application/ContactFieldSync";
import type { FlowDrafts } from "../../../domains/contact-fields/application/ContactFieldPorts";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlContactFieldRepository, SqlContactFieldValues } from "../../../infrastructure/persistence/sql/SqlContactFields";

// ---------------------------------------------------------------------------
// Campos del cliente: el catálogo con sus estadísticas (servicio de la
// pantalla y del MCP) y el paso de los datos de los flujos al cliente
// (`ContactFieldSync`, lo usa el turno de mensajería).
// ---------------------------------------------------------------------------

export interface ContactFieldModule {
  readonly services: ContactFieldServices;
  readonly sync: ContactFieldSync;
}

export interface ContactFieldDependencies {
  readonly sql: SqlClient;
  readonly automations: Pick<AutomationRepository, "findByTenant">;
  readonly workspaces: Pick<BuilderWorkspaceRepository, "getWorkspaces">;
}

/** Los borradores de los flujos que pueden correr (los archivados no cuentan como uso). */
function flowDrafts(deps: ContactFieldDependencies): FlowDrafts {
  return {
    drafts: async (tenantId) => {
      const flows = (await deps.automations.findByTenant(tenantId)).filter((flow) => flow.status !== "archived");
      if (flows.length === 0) return [];
      return (await deps.workspaces.getWorkspaces(tenantId, flows.map((flow) => flow.key))).map((workspace) => workspace.draft);
    }
  };
}

export function composeContactFieldServices(deps: ContactFieldDependencies): ContactFieldModule {
  const repository = new SqlContactFieldRepository(deps.sql);
  const values = new SqlContactFieldValues(deps.sql);
  return {
    services: new ContactFieldServices(repository, values, flowDrafts(deps)),
    sync: new ContactFieldSync(repository, values)
  };
}
