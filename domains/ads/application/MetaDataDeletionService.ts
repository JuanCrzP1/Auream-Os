import { createHash, randomBytes } from "node:crypto";
import type { MetaDataDeletionReceipt, MetaDataDeletionStatus } from "../../../contracts/MetaDataDeletionContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { readSignedRequest } from "./MetaSignedRequest";

// ---------------------------------------------------------------------------
// Lo que Meta exige a una app aprobada cuando una persona la quita de su
// Facebook o pide borrar sus datos:
//
//   deauthorize   quitó la app → se borra la conexión de Meta Ads (token y
//                 cuentas) que se hizo con su permiso
//   requestDeletion  pidió borrar sus datos → lo mismo, y queda constancia con
//                 un código para consultar (sin guardar quién es: solo una
//                 huella de su id)
//
// Lo que se borra es lo que Auream obtuvo de Meta con su permiso. Las ventas,
// chats y contactos son del negocio que usa Auream (no de Meta): para eso,
// la página de eliminación de datos explica cómo pedirlo.
// ---------------------------------------------------------------------------

export interface MetaDataDeletionStore {
  /** Cuentas de Auream cuya conexión de Meta Ads se hizo con esa persona de Meta. */
  tenantsConnectedBy(metaUserId: string): Promise<ReadonlyArray<string>>;
  record(entry: { readonly code: string; readonly userHash: string; readonly deletedConnections: number; readonly requestedAt: Date }): Promise<void>;
  find(code: string): Promise<{ readonly deletedConnections: number; readonly requestedAt: string } | null>;
}

export interface MetaConnectionRemover {
  removeConnection(tenantId: string): Promise<void>;
}

const CODE = /^[A-Z2-9]{12}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código para consultar: 12 caracteres sin los que se confunden (0/O, 1/I/L). */
function newCode(): string {
  return [...randomBytes(12)].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export class MetaDataDeletionService {
  public constructor(
    private readonly appSecret: string,
    private readonly store: MetaDataDeletionStore,
    private readonly connections: MetaConnectionRemover,
    /** Página pública donde se consulta el estado (`<origen>/eliminar-datos`). */
    private readonly statusPage: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** La persona quitó la app de su Facebook: se borra lo conectado con su permiso. */
  public async deauthorize(signedRequest: unknown): Promise<void> {
    await this.removeFor(this.verified(signedRequest));
  }

  /** La persona pidió borrar sus datos: se borran y queda la constancia con su código. */
  public async requestDeletion(signedRequest: unknown): Promise<MetaDataDeletionReceipt> {
    const userId = this.verified(signedRequest);
    const deletedConnections = await this.removeFor(userId);
    const code = newCode();
    await this.store.record({ code, userHash: createHash("sha256").update(`meta:${userId}`).digest("hex"), deletedConnections, requestedAt: this.now() });
    return { url: `${this.statusPage}?codigo=${code}`, confirmation_code: code };
  }

  public async status(code: string): Promise<MetaDataDeletionStatus> {
    const clean = code.trim().toUpperCase();
    const found = CODE.test(clean) ? await this.store.find(clean) : null;
    if (!found) throw new NotFoundError("No encontramos una solicitud con ese código.");
    return { code: clean, status: "completed", requestedAt: found.requestedAt, deletedConnections: found.deletedConnections };
  }

  private verified(signedRequest: unknown): string {
    const request = readSignedRequest(signedRequest, this.appSecret);
    if (!request) throw new ValidationError("La solicitud de Meta no es válida.");
    return request.userId;
  }

  private async removeFor(metaUserId: string): Promise<number> {
    const tenants = await this.store.tenantsConnectedBy(metaUserId);
    for (const tenantId of tenants) await this.connections.removeConnection(tenantId);
    return tenants.length;
  }
}
