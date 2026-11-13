import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import { ContactFieldServices } from "../../../domains/contact-fields/application/ContactFieldServices";
import { randomUUID } from "node:crypto";
import type { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import { ContactFieldMergeServices } from "../../../domains/contact-fields/application/ContactFieldMergeServices";
import { ContactFieldTidyServices } from "../../../domains/contact-fields/application/ContactFieldTidyServices";
import { SqlContactFieldInsights } from "../../../infrastructure/persistence/sql/SqlContactFieldInsights";
import { SqlContactFieldOperations } from "../../../infrastructure/persistence/sql/SqlContactFieldOperations";
import { contactFieldFlowRewriter } from "./contactFieldFlowRewriter";
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
  /** Ordenar valores y lo que vende cada valor. */
  readonly tidy: ContactFieldTidyServices;
  /** Unir campos y deshacer. */
  readonly merge: ContactFieldMergeServices;
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
  /** El guardado del editor: unir campos cambia la clave en los flujos por el mismo camino. */
  readonly saveDraft: Pick<SaveDraftService, "execute">;
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
  const operations = new SqlContactFieldOperations(deps.sql);
  const insights = new SqlContactFieldInsights(deps.sql);
  return {
    services: new ContactFieldServices(repository, values, flows, randomUUID, operations),
    tidy: new ContactFieldTidyServices(repository, insights, operations, randomUUID),
    merge: new ContactFieldMergeServices(repository, values, insights, operations, flows, contactFieldFlowRewriter(deps), randomUUID),
    values: new ContactFieldValueServices(repository, values, origins, flows, teamNames(deps.sql)),
    sync: new ContactFieldSync(repository, values, origins),
    catalog: contactFieldCatalog(repository)
  };
}
