import type { CampaignStats, GroupNumbers, GroupPostContent, GroupPostStatus } from "../../../contracts/GroupContracts";
import type { Campaign } from "../domain/Campaign";

// ---------------------------------------------------------------------------
// Lo que Grupos necesita de fuera. Todo por cuenta. La composición decide
// quién cumple cada puerto (uazapi, SQL, Contactos, la cola de tareas).
// ---------------------------------------------------------------------------

/** Un grupo guardado en Auream (de un número conectado). */
export interface WaGroup {
  readonly id: string;
  readonly tenantId: string;
  readonly connectionId: string;
  readonly jid: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly members: number;
  readonly isAdmin: boolean;
  readonly announce: boolean;
  readonly locked: boolean;
  readonly inviteLink: string | null;
  readonly campaignId: string | null;
  readonly position: number | null;
  readonly syncedAt: string | null;
  readonly lastWelcomeAt: string | null;
  readonly createdAt: string;
}

/** Un miembro: el teléfono si se sabe; si WhatsApp solo da su identificador anónimo, `phone` es `null`. */
export interface Member {
  readonly key: string;
  readonly phone: string | null;
  readonly isAdmin: boolean;
}

/** Un grupo tal como lo ve el proveedor. `members` es `null` si no vino la lista. */
export interface ProviderGroup {
  readonly jid: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly memberCount: number;
  readonly members: ReadonlyArray<Member> | null;
  readonly isAdmin: boolean;
  readonly announce: boolean;
  readonly locked: boolean;
  readonly inviteLink: string | null;
  /** Comunidad (el grupo padre) o su grupo de avisos: no se manejan aquí todavía. */
  readonly isCommunity: boolean;
}

export type GroupSettings = Partial<{ readonly name: string; readonly description: string; readonly imageUrl: string | null; readonly announce: boolean; readonly locked: boolean }>;

/** WhatsApp, por el número (uazapi). Lanza con un mensaje sin secretos si falla. */
export interface GroupGateway {
  list(tenantId: string, connectionId: string): Promise<ReadonlyArray<ProviderGroup>>;
  create(tenantId: string, connectionId: string, name: string): Promise<{ readonly jid: string }>;
  configure(tenantId: string, connectionId: string, jid: string, settings: GroupSettings): Promise<void>;
  inviteLink(tenantId: string, connectionId: string, jid: string): Promise<string>;
  /** `mentions`: «all» (todos, sin listar nombres) o teléfonos. Devuelve el id del mensaje. */
  send(tenantId: string, connectionId: string, jid: string, content: GroupPostContent, mentions: "all" | ReadonlyArray<string> | null): Promise<string | null>;
}

export interface GroupRepository {
  list(tenantId: string, campaignId?: string): Promise<ReadonlyArray<WaGroup>>;
  find(tenantId: string, id: string): Promise<WaGroup | null>;
  findByJid(tenantId: string, connectionId: string, jid: string): Promise<WaGroup | null>;
  /** Pone al día los grupos de un número (y sus miembros cuando vienen). Los que ya no están quedan fuera de la lista. */
  saveSynced(tenantId: string, connectionId: string, groups: ReadonlyArray<ProviderGroup>, at: Date): Promise<void>;
  /** Un grupo nuevo de una campaña. `false` si esa posición ya estaba tomada. */
  insertCreated(group: WaGroup): Promise<boolean>;
  update(tenantId: string, id: string, patch: Partial<Pick<WaGroup, "name" | "description" | "imageUrl" | "announce" | "locked" | "inviteLink" | "campaignId" | "position" | "lastWelcomeAt">>): Promise<void>;
  /** Entradas y salidas. Devuelve los que entraron de verdad (no estaban). */
  applyMoves(tenantId: string, groupId: string, joins: ReadonlyArray<Member>, leaves: ReadonlyArray<Member>, at: Date): Promise<ReadonlyArray<Member>>;
  /** Los que entraron desde `since` y siguen (con teléfono). */
  joinedSince(tenantId: string, groupId: string, since: Date): Promise<ReadonlyArray<string>>;
  recordClick(tenantId: string, campaignId: string, groupId: string | null, source: string | null, at: Date): Promise<void>;
  lastSyncedAt(tenantId: string): Promise<string | null>;
}

export interface CampaignRepository {
  create(campaign: Campaign): Promise<void>;
  update(tenantId: string, campaign: Campaign): Promise<void>;
  find(tenantId: string, id: string): Promise<Campaign | null>;
  /** Por su enlace (único en toda la plataforma: es público). */
  findBySlug(slug: string): Promise<Campaign | null>;
  list(tenantId: string): Promise<ReadonlyArray<Campaign>>;
  slugTaken(slug: string, exceptId: string | null): Promise<boolean>;
}

export interface GroupPost {
  readonly id: string;
  readonly tenantId: string;
  readonly content: GroupPostContent;
  readonly mentionAll: boolean;
  readonly status: GroupPostStatus;
  readonly target: string;
  readonly campaignIds: ReadonlyArray<string>;
  readonly scheduledAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
}

export interface PostRepository {
  create(post: GroupPost, groupIds: ReadonlyArray<string>): Promise<void>;
  find(tenantId: string, id: string): Promise<GroupPost | null>;
  list(tenantId: string, campaignId: string | null, limit: number): Promise<ReadonlyArray<GroupPost & { readonly groups: number; readonly sent: number; readonly failed: number }>>;
  transition(tenantId: string, id: string, from: ReadonlyArray<GroupPostStatus>, to: GroupPostStatus, finishedAt?: Date): Promise<boolean>;
  /** Reserva el siguiente grupo pendiente del envío. */
  claimNext(tenantId: string, postId: string): Promise<{ readonly deliveryId: string; readonly groupId: string } | null>;
  finishDelivery(tenantId: string, deliveryId: string, outcome: { readonly ok: boolean; readonly providerMessageId: string | null; readonly error: string | null }, at: Date): Promise<void>;
  cancelPending(tenantId: string, postId: string): Promise<void>;
}

export interface GroupResults {
  /** Por grupo: miembros, entradas y salidas, compradores y plata (desde `since`). */
  groups(tenantId: string, groupIds: ReadonlyArray<string>, since: Date | null): Promise<ReadonlyMap<string, GroupNumbers>>;
  /** Por campaña, con los clics al enlace. */
  campaigns(tenantId: string, campaignIds: ReadonlyArray<string>, since: Date | null): Promise<ReadonlyMap<string, CampaignStats>>;
  daily(tenantId: string, campaignId: string, days: number, timezone: string): Promise<ReadonlyArray<{ readonly day: string; readonly clicks: number; readonly joined: number; readonly left: number }>>;
}

/** Los números de la cuenta (Conexiones). */
export interface NumberDirectory {
  list(tenantId: string): Promise<ReadonlyArray<{ readonly id: string; readonly name: string; readonly connected: boolean; readonly qr: boolean }>>;
}

/** Contactos: quien entra a un grupo de campaña queda con la etiqueta de la campaña. */
export interface GroupLabeler {
  tag(tenantId: string, phone: string, label: string): Promise<void>;
}

/** La cola de tareas. */
export interface GroupTicker {
  sync(tenantId: string, at: Date): Promise<void>;
  prepare(tenantId: string, campaignId: string, at: Date): Promise<void>;
  welcome(tenantId: string, groupId: string, at: Date): Promise<void>;
  post(tenantId: string, postId: string, at: Date): Promise<void>;
  apply(tenantId: string, campaignId: string, at: Date): Promise<void>;
  stopPost(tenantId: string, postId: string): Promise<void>;
}
