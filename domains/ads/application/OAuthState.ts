import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// OAuthState — el `state` del inicio de sesión de Meta. Lleva la cuenta y la
// persona que lo pidió, vence en 10 minutos y va firmado (HMAC-SHA256 con una
// clave del servidor): la vuelta de Meta no trae sesión, así que este sello
// es lo único que dice a qué cuenta pertenece el token.
// ---------------------------------------------------------------------------

const TTL_MS = 10 * 60_000;

export interface OAuthStatePayload {
  readonly tenantId: string;
  readonly userId: string;
}

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

export class OAuthStateSigner {
  public constructor(private readonly secret: string, private readonly now: () => number = () => Date.now()) {
    if (secret.length < 16) throw new Error("La clave para firmar el inicio de sesión de Meta es muy corta.");
  }

  public sign(payload: OAuthStatePayload): string {
    const body = encode(JSON.stringify({ t: payload.tenantId, u: payload.userId, e: this.now() + TTL_MS, n: randomBytes(8).toString("hex") }));
    return `${body}.${this.mac(body)}`;
  }

  /** El dueño del `state`, o `null` si está alterado, es de otro servidor o venció. */
  public verify(state: string): OAuthStatePayload | null {
    const [body, mac] = state.split(".");
    if (!body || !mac) return null;
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const parsed = JSON.parse(decode(body)) as { t?: unknown; u?: unknown; e?: unknown };
      if (typeof parsed.t !== "string" || typeof parsed.u !== "string" || typeof parsed.e !== "number" || parsed.e < this.now()) return null;
      return { tenantId: parsed.t, userId: parsed.u };
    } catch {
      return null;
    }
  }

  private mac(body: string): string {
    return createHmac("sha256", this.secret).update(`meta-oauth:${body}`).digest("base64url");
  }
}
