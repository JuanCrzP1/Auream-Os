import type { Member, ProviderGroup } from "../../../domains/groups/application/GroupPorts";
import { record, text, type Json } from "./uazapiResponses";

// ---------------------------------------------------------------------------
// Grupos de uazapi (`Group` de /group/list y /group/info) y sus avisos
// (`EventType: "groups"`). Los miembros llegan como texto («573…@s.whatsapp.net»,
// «…@lid») o como objetos (`PhoneNumber`, `JID`, `LID`): se aceptan los dos.
// docs.uazapi.com/reference/webhooks/groups
// ---------------------------------------------------------------------------

const digits = (value: string) => value.replace(/\D/g, "");

/** Un miembro: su teléfono si se sabe (@s.whatsapp.net o PhoneNumber); si solo hay @lid, sin teléfono. */
export function toMember(value: unknown): Member | null {
  if (typeof value === "string") return fromJid(value, false);
  const item = record(value);
  const isAdmin = item["IsAdmin"] === true || item["IsSuperAdmin"] === true;
  const phone = digits(text(item["PhoneNumber"]).split("@")[0] ?? "");
  if (phone.length >= 7) return { key: phone, phone, isAdmin };
  return fromJid(text(item["JID"]) || text(item["LID"]), isAdmin);
}

function fromJid(jid: string, isAdmin: boolean): Member | null {
  const [user = "", server = ""] = jid.split("@");
  const id = digits(user.split(":")[0] ?? "");
  if (!id) return null;
  if (server === "lid") return { key: `lid:${id}`, phone: null, isAdmin };
  return id.length >= 7 && id.length <= 15 ? { key: id, phone: id, isAdmin } : null;
}

/** `ownPhone`: el número conectado (solo dígitos), para saber si es administrador. */
export function toProviderGroup(value: unknown, ownPhone: string | null): ProviderGroup | null {
  const group = record(value);
  const jid = text(group["JID"]);
  if (!/^[0-9-]+@g\.us$/.test(jid)) return null;
  const participants = Array.isArray(group["Participants"]) ? group["Participants"] : null;
  const members = participants ? participants.map(toMember).filter((m): m is Member => m !== null) : null;
  const me = ownPhone ? members?.find((member) => member.phone === ownPhone) : undefined;
  const ownerIsMe = ownPhone !== null && digits(text(group["OwnerJID"]).split("@")[0] ?? "") === ownPhone;
  return {
    jid,
    name: text(group["Name"]),
    description: text(group["Topic"]),
    imageUrl: text(group["image_url"]) || null,
    memberCount: typeof group["ParticipantCount"] === "number" ? group["ParticipantCount"] : members?.length ?? 0,
    members,
    isAdmin: Boolean(me?.isAdmin) || (ownerIsMe && group["OwnerIsAdmin"] !== false),
    announce: group["IsAnnounce"] === true,
    locked: group["IsLocked"] === true,
    inviteLink: text(group["invite_link"]) || null,
    isCommunity: group["IsParent"] === true || group["IsDefaultSubGroup"] === true
  };
}

export interface UazapiGroupEvent {
  readonly instanceName: string;
  readonly token: string;
  readonly jid: string;
  readonly joins: ReadonlyArray<Member>;
  readonly leaves: ReadonlyArray<Member>;
}

const members = (value: unknown): Member[] => (Array.isArray(value) ? value.map(toMember).filter((m): m is Member => m !== null) : []);

/** El aviso de entradas y salidas de un grupo; `null` si no es uno o no trae cambios de miembros. */
export function parseUazapiGroupEvent(body: Json): UazapiGroupEvent | null {
  if (text(body["EventType"]) !== "groups") return null;
  const event = record(body["event"]);
  const jid = text(event["JID"]) || text(body["chatid"]);
  if (!/@g\.us$/.test(jid)) return null;
  const joins = members(event["Join"]);
  const leaves = members(event["Leave"]);
  if (joins.length === 0 && leaves.length === 0) return null;
  return { instanceName: text(body["instanceName"]), token: text(body["token"]), jid, joins, leaves };
}
