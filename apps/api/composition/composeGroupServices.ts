import { randomUUID } from "node:crypto";
import type { ApiConfig } from "../config/loadApiConfig";
import { CampaignServices } from "../../../domains/groups/application/CampaignServices";
import { GroupActivity } from "../../../domains/groups/application/GroupActivity";
import type { GroupEngine } from "../../../domains/groups/application/GroupEngine";
import { GroupMaker } from "../../../domains/groups/application/GroupMaker";
import { GroupServices } from "../../../domains/groups/application/GroupServices";
import { GroupSync } from "../../../domains/groups/application/GroupSync";
import { LinkService } from "../../../domains/groups/application/LinkService";
import { PostDispatcher } from "../../../domains/groups/application/PostDispatcher";
import { PostServices } from "../../../domains/groups/application/PostServices";
import type { ConnectionChannelServices } from "../../../domains/connections/application/ConnectionChannelServices";
import type { ListConnectionsService } from "../../../domains/connections/application/ConnectionServices";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { ContactDirectory } from "../../../flow-engine/ports/ContactDirectory";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlGroupCampaigns } from "../../../infrastructure/persistence/sql/SqlGroupCampaigns";
import { SqlGroupPosts } from "../../../infrastructure/persistence/sql/SqlGroupPosts";
import { SqlGroupResults } from "../../../infrastructure/persistence/sql/SqlGroupResults";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";
import { SqlWaGroups } from "../../../infrastructure/persistence/sql/SqlWaGroups";
import { UazapiGroupClient } from "../../../infrastructure/whatsapp/uazapi/UazapiGroupClient";
import { connectionNumbers, directoryLabeler, uazapiGroupGateway } from "./groupGateway";
import { groupTaskHandlers, SchedulerGroupTicker } from "./groupTaskAdapters";

// ---------------------------------------------------------------------------
// composeGroupServices — Grupos sobre PostgreSQL, uazapi y la cola de tareas.
// Sin uazapi configurado el módulo igual responde (sin grupos que traer).
// ---------------------------------------------------------------------------

export interface GroupDependencies {
  readonly config: ApiConfig;
  readonly sql: SqlClient;
  readonly scheduler: TaskScheduler;
  readonly connections: { readonly list: Pick<ListConnectionsService, "execute">; readonly channel: Pick<ConnectionChannelServices, "sessionFor"> };
  readonly contacts: ContactDirectory;
}

export interface GroupModule {
  readonly campaigns: CampaignServices;
  readonly groups: GroupServices;
  readonly posts: PostServices;
  readonly link: LinkService;
  /** Entradas y salidas que avisa el proveedor. */
  readonly activity: GroupActivity;
  readonly handlers: ReadonlyArray<TaskHandler>;
}

export function composeGroupServices(deps: GroupDependencies): GroupModule {
  const { sql } = deps;
  const tenants = new SqlTenantResolver(sql, deps.config.defaultTimezone);
  const client = new UazapiGroupClient({ baseUrl: deps.config.uazapi?.baseUrl ?? "https://uazapi.invalid" });
  const engine: GroupEngine = {
    campaigns: new SqlGroupCampaigns(sql),
    groups: new SqlWaGroups(sql),
    posts: new SqlGroupPosts(sql),
    results: new SqlGroupResults(sql),
    gateway: uazapiGroupGateway(deps.connections.channel, client),
    numbers: connectionNumbers(deps.connections.list),
    labeler: directoryLabeler(deps.contacts),
    ticker: new SchedulerGroupTicker(deps.scheduler),
    timezoneOf: async (tenantId) => (await tenants.resolve(tenantId)).timezone,
    now: () => new Date(),
    random: Math.random,
    newId: randomUUID,
    linkBase: deps.config.groupLinkBase
  };
  const maker = new GroupMaker(engine);
  const sync = new GroupSync(engine, maker);
  const posts = new PostServices(engine);
  const campaigns = new CampaignServices(engine, posts);
  const activity = new GroupActivity(engine);
  return {
    campaigns,
    groups: new GroupServices(engine, sync),
    posts,
    link: new LinkService(engine, maker),
    activity,
    handlers: groupTaskHandlers({ sync, maker, activity, dispatcher: new PostDispatcher(engine), campaigns })
  };
}
