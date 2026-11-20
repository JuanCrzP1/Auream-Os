import { PUSH_TOPICS, type PushTopic } from "../../../contracts/NotificationSettingsContracts";
import { ROLE_SCOPES } from "../../../platform/authorization/roles/RoleDefinitions";
import type { Role } from "../../../platform/authorization/contracts/Role";

// ---------------------------------------------------------------------------
// Quién puede recibir cada aviso: el mismo permiso que hace falta para
// resolverlo en la pantalla.
//
//   chat_message         atender chats             (conversations.write)
//   number_disconnected  reconectar el número      (connections.write: dueños y administradores)
//   sale_review          revisar ventas            (sales.manage: dueños y administradores)
//   follow_up_due        llevar seguimientos       (crm.write)
//
// Además, cada aviso tiene su destinatario: el de un chat, a quien lo atiende;
// el de un seguimiento, a quien se le asignó (ver `PushNotifier`).
// ---------------------------------------------------------------------------

export const TOPIC_SCOPE: Readonly<Record<PushTopic, string>> = {
  chat_message: "conversations.write",
  number_disconnected: "connections.write",
  sale_review: "sales.manage",
  follow_up_due: "crm.write"
};

/** Los avisos que tiene sentido ofrecerle a quien tiene estos permisos. */
export function topicsFor(scopes: ReadonlyArray<string>): ReadonlyArray<PushTopic> {
  return PUSH_TOPICS.filter((topic) => scopes.includes(TOPIC_SCOPE[topic]));
}

/** ¿Una persona con este rol puede recibir este aviso? */
export function roleReceives(role: string, topic: PushTopic): boolean {
  const scopes = ROLE_SCOPES[role as Role] as ReadonlyArray<string> | undefined;
  return Boolean(scopes?.includes(TOPIC_SCOPE[topic]));
}

export function isPushTopic(value: unknown): value is PushTopic {
  return typeof value === "string" && (PUSH_TOPICS as ReadonlyArray<string>).includes(value);
}
