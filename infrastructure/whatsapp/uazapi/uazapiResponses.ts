// ---------------------------------------------------------------------------
// Lectura de las respuestas de uazapi: el estado de una instancia (QR, número,
// perfil) y el id que WhatsApp le da a cada mensaje enviado. Solo transforma
// JSON; las llamadas están en `UazapiClient`.
// ---------------------------------------------------------------------------

export interface UazapiInstanceInfo {
  readonly id: string;
  readonly token: string;
  /** `disconnected` · `connecting` · `connected` · `hibernated`. */
  readonly status: string;
  /** QR como data URL (vacío mientras se genera). */
  readonly qrcode: string;
  readonly profileName: string | null;
  /** Número conectado, solo dígitos (de `status.jid.user`). */
  readonly phoneNumber: string | null;
}

export type Json = Record<string, unknown>;

export const record = (value: unknown): Json => (typeof value === "object" && value !== null ? (value as Json) : {});
export const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Id de WhatsApp del mensaje enviado (`messageid`; con el que llegan entregado/leído). */
export const sentId = (body: Json): string | null => text(body["messageid"]) || text(record(body["message"])["messageid"]) || null;

function digits(value: unknown): string | null {
  const only = text(value).split("@")[0]!.replace(/\D/g, "");
  return only.length >= 7 && only.length <= 15 ? only : null;
}

/** Algunos servidores devuelven el PNG sin el prefijo `data:`. */
function asDataUrl(qr: string): string {
  if (!qr) return "";
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

export function toInstanceInfo(body: Json): UazapiInstanceInfo {
  const instance = record(body["instance"]);
  const status = record(body["status"]);
  const jid = record(status["jid"] ?? body["jid"]);
  return {
    id: text(instance["id"]),
    token: text(instance["token"] ?? body["token"]),
    status: text(instance["status"]) || (status["connected"] === true || body["connected"] === true ? "connected" : "disconnected"),
    qrcode: asDataUrl(text(instance["qrcode"])),
    profileName: text(instance["profileName"]) || null,
    phoneNumber: digits(jid["user"]) ?? digits(instance["owner"])
  };
}
