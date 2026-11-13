import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import { ContactFieldServices } from "../../../domains/contact-fields/application/ContactFieldServices";
import { ContactFieldSync } from "../../../domains/contact-fields/application/ContactFieldSync";
import { ContactFieldValueServices } from "../../../domains/contact-fields/application/ContactFieldValueServices";
import { SqlContactFieldOrigins } from "../../../infrastructure/persistence/sql/SqlContactFieldOrigins";
import { SqlTeamRepository } from "../../../infrastructure/persistence/sql/SqlTeamRepository";
import type { ContactFieldRepository, FlowDrafts, TeamNames } from "../../../domains/contact-fields/application/ContactFieldPorts";
import type { ContactFieldCatalog } from "../../../flow-engine/ports/ContactFieldCatalog";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlContactFieldRepository, SqlContactFieldValues } from "../../../infrastructure/persistence/sql/SqlContactFields";

// ---------------------------------------------------------------------------
// Campos del cliente: el catálogo con sus estadísticas (servicio de la
// pantalla y del MCP) y el paso de los datos de los flujos al cliente
// (`ContactFieldSync`, lo usa el turno de mensajería).
// ---------------------------------------------------------------------------

export interface ContactFieldModule {
  readonly services: ContactFieldServices;
  /** La ficha de cada cliente: sus datos, de dónde salieron, y editarlos. */
  readonly values: ContactFieldValueServices;
  readonly sync: ContactFieldSync;
  /** El tipo de cada clave para el motor (Esperar respuesta: volver a preguntar). */
  readonly catalog: ContactFieldCatalog;
}

/** Solo lectura, sin depender de los flujos: lo usan también el laboratorio y el motor. */
export function contactFieldCatalog(repository: Pick<ContactFieldRepository, "findByKey">): ContactFieldCatalog {
  return {
    find: async (tenantId, key) => {
      const field = await repository.findByKey(tenantId, key);
      return field ? { type: field.type, options: field.options } : null;
    }
  };
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

/** «Lo cambió Ana»: el nombre (o el correo) de cada persona del equipo. */
function teamNames(sql: SqlClient): TeamNames {
  const team = new SqlTeamRepository(sql);
  return {
    names: async (tenantId) => new Map((await team.listMembers(tenantId)).map((member) => [member.userId, member.displayName ?? member.email ?? "Alguien del equipo"]))
  };
}

export function composeContactFieldServices(deps: ContactFieldDependencies): ContactFieldModule {
  const repository = new SqlContactFieldRepository(deps.sql);
  const values = new SqlContactFieldValues(deps.sql);
  const origins = new SqlContactFieldOrigins(deps.sql);
  const flows = flowDrafts(deps);
  return {
    services: new ContactFieldServices(repository, values, flows),
    values: new ContactFieldValueServices(repository, values, origins, flows, teamNames(deps.sql)),
    sync: new ContactFieldSync(repository, values, origins),
    catalog: contactFieldCatalog(repository)
  };
}
