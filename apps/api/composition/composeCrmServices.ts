import type { ApiConfig } from "../config/loadApiConfig";
import { BoardServices } from "../../../domains/crm/application/BoardServices";
import type { ContactLabeler, CrmProductCatalog, CrmTeamDirectory, StageLabels } from "../../../domains/crm/application/CrmGateways";
import { DealOwnerClaims } from "../../../domains/crm/application/DealOwnerClaims";
import { ClientImport } from "../../../domains/crm/application/ClientImport";
import { SqlCrmImportCandidates } from "../../../infrastructure/persistence/sql/SqlCrmImportCandidates";
import { DealServices } from "../../../domains/crm/application/DealServices";
import { FollowUpServices } from "../../../domains/crm/application/FollowUpServices";
import { PipelineServices } from "../../../domains/crm/application/PipelineServices";
import { StageTracker } from "../../../domains/crm/application/StageTracker";
import type { ContactRepository, LabelRepository } from "../../../domains/contacts/application/ContactRepository";
import { labelKey } from "../../../domains/contacts/domain/Label";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlCrmBoard } from "../../../infrastructure/persistence/sql/SqlCrmBoard";
import { SqlCrmDealRepository } from "../../../infrastructure/persistence/sql/SqlCrmDealRepository";
import { SqlCrmEventLog } from "../../../infrastructure/persistence/sql/SqlCrmEventLog";
import { SqlCrmPipelineRepository } from "../../../infrastructure/persistence/sql/SqlCrmPipelineRepository";
import { SqlFollowUpRepository } from "../../../infrastructure/persistence/sql/SqlFollowUpRepository";
import { SqlRoundRobinCounter } from "../../../infrastructure/persistence/sql/SqlRoundRobinCounter";
import { SqlTeamRepository } from "../../../infrastructure/persistence/sql/SqlTeamRepository";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";
import type { CrmRoutes } from "../routes/routeCrmRequest";

// ---------------------------------------------------------------------------
// composeCrmServices — el CRM sobre PostgreSQL. Habla con Contactos (las
// etapas son etiquetas), Productos (el valor por defecto) y Equipo (quién
// puede ser responsable) SOLO por sus puertos; aquí se decide quién los cumple.
// ---------------------------------------------------------------------------

export interface CrmDependencies {
  readonly config: ApiConfig;
  readonly sql: SqlClient;
  /** El repositorio de Contactos YA con sus reglas (grupos excluyentes y avisos). */
  readonly contacts: ContactRepository;
  readonly labels: LabelRepository;
  readonly products: CrmProductCatalog;
  readonly onError: (error: unknown, context: Record<string, unknown>) => void;
}

export interface CrmModule {
  readonly routes: CrmRoutes;
  /** Escucha a Contactos y a Ventas (se conecta con `CrmEventsRelay`). */
  readonly tracker: StageTracker;
  /** El responsable compartido con Conversaciones (al tomar o pasar un chat). */
  readonly ownerClaims: DealOwnerClaims;
}

export function composeCrmServices(deps: CrmDependencies): CrmModule {
  const { sql } = deps;
  const pipelineRepository = new SqlCrmPipelineRepository(sql);
  const deals = new SqlCrmDealRepository(sql);
  const events = new SqlCrmEventLog(sql);
  const followUpRepository = new SqlFollowUpRepository(sql);
  const tenants = new SqlTenantResolver(sql, deps.config.defaultTimezone);
  const timezoneOf = async (tenantId: string) => (await tenants.resolve(tenantId)).timezone;
  const labeler = contactLabeler(deps.contacts);
  const team = teamDirectory(new SqlTeamRepository(sql));

  const pipelines = new PipelineServices(pipelineRepository, stageLabels(deps.labels), team, deps.products);
  return {
    routes: {
      pipelines,
      board: new BoardServices(pipelines, new SqlCrmBoard(sql), labeler),
      deals: new DealServices(pipelines, pipelineRepository, deals, events, followUpRepository, labeler, deps.products, team),
      followUps: new FollowUpServices(followUpRepository, labeler, team, timezoneOf),
      imports: new ClientImport(pipelines, new SqlCrmImportCandidates(sql), labeler)
    },
    ownerClaims: new DealOwnerClaims(deals, events, team),
    tracker: new StageTracker(pipelineRepository, deals, events, labeler, deps.products, team, new SqlRoundRobinCounter(sql), deps.onError)
  };
}

function contactLabeler(contacts: ContactRepository): ContactLabeler {
  return {
    snapshot: async (tenantId, contactId) => {
      const found = await contacts.findById(tenantId, contactId);
      return found ? { phone: found.contact.phone, labelIds: found.labels.map((label) => label.id), fromAd: Boolean(found.contact.adOrigin), adSourceId: found.contact.adOrigin?.sourceId ?? null } : null;
    },
    change: (tenantId, contactId, change, origin) => contacts.changeLabels(tenantId, contactId, change, origin)
  };
}

function stageLabels(labels: LabelRepository): StageLabels {
  const view = (label: { id: string; name: string; color: string }) => ({ id: label.id, name: label.name, color: label.color });
  return {
    ensure: async (tenantId, name, color) => {
      const [found] = await labels.findByNames(tenantId, [name]);
      if (found) return view(found);
      const label = { id: crypto.randomUUID(), tenantId, name, color: color ?? "#6c5ce7", createdAt: new Date().toISOString() };
      try {
        await labels.create(label);
        return view(label);
      } catch (error) {
        // Otra petición la creó a la vez: se usa esa.
        const [again] = error instanceof ConflictError ? await labels.findByNames(tenantId, [name]) : [];
        if (again && labelKey(again.name) === labelKey(name)) return view(again);
        throw error;
      }
    },
    find: async (tenantId, labelId) => {
      const label = await labels.findById(tenantId, labelId);
      return label ? view(label) : null;
    },
    update: async (tenantId, labelId, name, color) => {
      const label = await labels.findById(tenantId, labelId);
      if (label) await labels.update({ ...label, name, color });
    }
  };
}

function teamDirectory(team: SqlTeamRepository): CrmTeamDirectory {
  return {
    members: async (tenantId) =>
      (await team.listMembers(tenantId)).map((member) => ({
        userId: member.userId,
        name: member.displayName ?? member.email ?? "Sin nombre",
        photoUrl: member.photoUrl,
        canSell: member.role !== "viewer" && member.role !== "api_client" && member.role !== "worker"
      }))
  };
}
