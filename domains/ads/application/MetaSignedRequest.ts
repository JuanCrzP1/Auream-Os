import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// El `signed_request` con el que Meta avisa que alguien quitó la app o pidió
// borrar sus datos: `<firma>.<datos>`, ambos en base64url. La firma es
// HMAC-SHA256 de los datos con la clave secreta de la app: solo Meta y
// nosotros la conocemos, así que nadie más puede pedir un borrado en su nombre.
// ---------------------------------------------------------------------------

export interface MetaSignedRequest {
  /** Id de la persona en esta app (lo que Meta llama «user_id»). */
  readonly userId: string;
  readonly issuedAt: number | null;
}

const MAX_LENGTH = 4096;

const fromBase64Url = (value: string) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Los datos del aviso, o `null` si está mal formado o la firma no es de Meta para esta app. */
export function readSignedRequest(signedRequest: unknown, appSecret: string): MetaSignedRequest | null {
  if (typeof signedRequest !== "string" || signedRequest.length > MAX_LENGTH) return null;
  const [signature, payload, extra] = signedRequest.split(".");
  if (!signature || !payload || extra !== undefined) return null;

  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = fromBase64Url(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fromBase64Url(payload).toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (String(data["algorithm"] ?? "").toUpperCase() !== "HMAC-SHA256") return null;
  const userId = typeof data["user_id"] === "string" || typeof data["user_id"] === "number" ? String(data["user_id"]) : "";
  if (!/^\d{1,40}$/.test(userId)) return null;
  return { userId, issuedAt: typeof data["issued_at"] === "number" ? data["issued_at"] : null };
}
