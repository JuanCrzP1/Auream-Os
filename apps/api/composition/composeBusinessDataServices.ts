import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import { BusinessDataServices } from "../../../domains/business-data/application/BusinessDataServices";
import type { BusinessDataTexts } from "../../../domains/business-data/application/BusinessDataPorts";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlBusinessDataRepository, SqlBusinessValues } from "../../../infrastructure/persistence/sql/SqlBusinessData";
import { SqlBusinessDataTexts } from "../../../infrastructure/persistence/sql/SqlBusinessDataTexts";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";

// ---------------------------------------------------------------------------
// Datos del negocio: los valores que lee el motor en cada turno (se arman
// primero: los necesitan el laboratorio y la mensajería) y el servicio de la
// pantalla, que mira los flujos, las difusiones y las respuestas rápidas para
// decir dónde se usa cada dato, con sus cambios programados e historial. Comparten la memoria de los valores: un
// cambio en la pantalla se ve en el siguiente mensaje de este servidor.
// ---------------------------------------------------------------------------

export function composeBusinessValues(sql: SqlClient): SqlBusinessValues {
  return new SqlBusinessValues(new SqlBusinessDataRepository(sql));
}

export interface BusinessDataDependencies {
  readonly sql: SqlClient;
  readonly values: SqlBusinessValues;
  readonly automations: Pick<AutomationRepository, "findByTenant">;
  readonly workspaces: Pick<BuilderWorkspaceRepository, "getWorkspaces">;
  /** La de la plataforma, para la empresa que no eligió una (Empresa). */
  readonly defaultTimezone: string;
}

export function composeBusinessDataServices(deps: BusinessDataDependencies): BusinessDataServices {
  const others = new SqlBusinessDataTexts(deps.sql);
  const texts: BusinessDataTexts = {
    // Los flujos que pueden correr (los archivados no cuentan como uso).
    flows: async (tenantId) => {
      const flows = (await deps.automations.findByTenant(tenantId)).filter((flow) => flow.status !== "archived");
      if (flows.length === 0) return [];
      return (await deps.workspaces.getWorkspaces(tenantId, flows.map((flow) => flow.key))).map((workspace) => workspace.draft);
    },
    broadcasts: (tenantId) => others.broadcasts(tenantId),
    quickReplies: (tenantId) => others.quickReplies(tenantId)
  };
  // Los cambios programados se eligen en la hora de la empresa, igual que en los flujos.
  const tenants = new SqlTenantResolver(deps.sql, deps.defaultTimezone);
  const timeZoneOf = async (tenantId: string) => (await tenants.resolve(tenantId)).timezone;
  return new BusinessDataServices(new SqlBusinessDataRepository(deps.sql), texts, deps.values, { timeZoneOf });
}
