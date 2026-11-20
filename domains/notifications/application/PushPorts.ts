import type { PushTopic } from "../../../contracts/NotificationSettingsContracts";
import type { PushMessage } from "../domain/PushMessages";

// ---------------------------------------------------------------------------
// Lo que los avisos del celular necesitan de afuera. Los dispositivos son de
// la PERSONA; lo que le suena, de la persona en cada empresa. La composición
// decide quién cumple cada puerto (PostgreSQL, web-push).
// ---------------------------------------------------------------------------

export interface StoredPushDevice {
  readonly id: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

export interface PushDeviceStore {
  /** Guarda el dispositivo (o lo pasa a esta persona si el navegador ya era de otra). Devuelve su id. */
  save(device: { readonly userId: string; readonly endpoint: string; readonly p256dh: string; readonly auth: string; readonly label: string }): Promise<string>;
  listForUser(userId: string): Promise<ReadonlyArray<StoredPushDevice>>;
  listForUsers(userIds: ReadonlyArray<string>): Promise<ReadonlyArray<StoredPushDevice>>;
  /** Solo si es de esa persona. */
  remove(userId: string, deviceId: string): Promise<boolean>;
  /** El servicio dijo que ya no existe (se desinstaló, se revocó el permiso). */
  forget(deviceId: string): Promise<void>;
  touch(deviceId: string, at: Date): Promise<void>;
}

export interface PushPreferenceStore {
  /** Lo que la persona cambió en esta empresa (lo que no está, sigue prendido). */
  get(tenantId: string, userId: string): Promise<ReadonlyMap<PushTopic, boolean>>;
  set(tenantId: string, userId: string, topic: PushTopic, enabled: boolean, at: Date): Promise<void>;
  /** De estas personas, quiénes apagaron este aviso en esta empresa. */
  mutedAmong(tenantId: string, topic: PushTopic, userIds: ReadonlyArray<string>): Promise<ReadonlySet<string>>;
}

export type PushResult = "sent" | "gone" | "failed";

/** El servicio de avisos (Web Push con las claves VAPID de la plataforma). */
export interface PushSender {
  readonly publicKey: string;
  send(device: StoredPushDevice, message: PushMessage): Promise<PushResult>;
}

export interface TeamMember {
  readonly userId: string;
  readonly role: string;
}

/** Quién está en la empresa y los datos de cada evento que el aviso necesita leer. */
export interface PushAudience {
  /** Las personas activas de la empresa con su rol. */
  members(tenantId: string): Promise<ReadonlyArray<TeamMember>>;
  /** El chat de ese número con ese cliente, si lo atiende una persona. */
  chatAttendant(tenantId: string, connectionId: string, phone: string): Promise<{ readonly conversationId: string; readonly assigneeId: string; readonly contactName: string | null } | null>;
  connectionName(tenantId: string, connectionId: string): Promise<string | null>;
  followUp(tenantId: string, followUpId: string): Promise<{ readonly title: string; readonly contactName: string | null; readonly assigneeId: string | null; readonly dueAt: string; readonly doneAt: string | null } | null>;
}
