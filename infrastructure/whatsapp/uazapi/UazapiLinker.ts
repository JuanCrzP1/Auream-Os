import {
  LinkerError,
  type LinkTarget,
  type ProviderSession,
  type SessionState,
  type StartOutcome,
  type WhatsAppLinker
} from "../../../domains/connections/application/ports/WhatsAppLinker";
import { UazapiClient, UazapiError } from "./UazapiClient";
import type { UazapiInstanceInfo } from "./uazapiResponses";

// ---------------------------------------------------------------------------
// Vinculación por código QR con uazapi.
//
// Cada conexión de Auream es una instancia de uazapi llamada
// `auream-<id de la conexión>`: así un aviso de uazapi dice a qué conexión
// pertenece, y Auream lo comprueba con el token de la instancia.
// ---------------------------------------------------------------------------

export const UAZAPI_INSTANCE_PREFIX = "auream-";
/** Avisos que Auream pide a cada instancia: su conexión y los mensajes que llegan. */
/** Avisos que pide Auream: conexión, mensajes y recibos de entregado/leído. */
export const WEBHOOK_EVENTS = ["connection", "messages", "messages_update"] as const;
/** Nombre del dispositivo que ve el cliente en «Dispositivos vinculados». */
const DEVICE_NAME = "Auream";

export function instanceNameFor(connectionId: string): string {
  return `${UAZAPI_INSTANCE_PREFIX}${connectionId}`;
}

function toState(info: UazapiInstanceInfo): SessionState {
  if (info.status === "connected" && info.phoneNumber) return { kind: "connected", phoneNumber: info.phoneNumber, profileName: info.profileName, profilePictureUrl: info.profilePictureUrl };
  if (info.status === "connecting") return { kind: "qr", qrImage: info.qrcode };
  return { kind: "disconnected" };
}

function asLinkerError(error: unknown): never {
  if (error instanceof UazapiError) throw new LinkerError(error.message);
  throw error;
}

export class UazapiLinker implements WhatsAppLinker {
  public constructor(
    private readonly client: UazapiClient,
    /** URL pública donde uazapi avisa los cambios de conexión; `null` = sin avisos (desarrollo). */
    private readonly webhookUrl: string | null
  ) {}

  public async start(target: LinkTarget, session: ProviderSession | null): Promise<StartOutcome> {
    try {
      if (session) {
        try {
          return { ...(await this.connect(session.secret)), session };
        } catch (error) {
          // La instancia ya no existe en uazapi (borrada o vencida): se crea otra.
          if (!(error instanceof UazapiError && (error.reason === "not_found" || error.reason === "unauthorized"))) throw error;
        }
      }
      const created = await this.client.createInstance(instanceNameFor(target.id), DEVICE_NAME);
      const fresh: ProviderSession = { ref: created.id, secret: created.token };
      if (this.webhookUrl) await this.client.setWebhook(created.token, this.webhookUrl, WEBHOOK_EVENTS);
      return { ...(await this.connect(created.token)), session: fresh };
    } catch (error) {
      return asLinkerError(error);
    }
  }

  /** Medido con uazapi: pedir el QR otra vez da el MISMO; desconectar y conectar da uno nuevo. */
  public async restart(session: ProviderSession): Promise<SessionState> {
    try {
      await this.client.disconnect(session.secret);
      return await this.connect(session.secret);
    } catch (error) {
      return asLinkerError(error);
    }
  }

  /** Vuelve a registrar los avisos (conexión y mensajes) en la instancia. */
  public async refresh(session: ProviderSession): Promise<void> {
    if (!this.webhookUrl) return;
    try {
      await this.client.setWebhook(session.secret, this.webhookUrl, WEBHOOK_EVENTS);
    } catch (error) {
      asLinkerError(error);
    }
  }

  public async check(session: ProviderSession): Promise<SessionState> {
    try {
      return toState(await this.client.status(session.secret));
    } catch (error) {
      if (error instanceof UazapiError && (error.reason === "not_found" || error.reason === "unauthorized")) return { kind: "disconnected" };
      return asLinkerError(error);
    }
  }

  public async disconnect(session: ProviderSession): Promise<void> {
    try {
      await this.client.disconnect(session.secret);
    } catch (error) {
      asLinkerError(error);
    }
  }

  public async reset(session: ProviderSession): Promise<void> {
    try {
      await this.client.reset(session.secret);
    } catch (error) {
      asLinkerError(error);
    }
  }

  public async unlink(session: ProviderSession): Promise<void> {
    try {
      await this.client.deleteInstance(session.secret);
    } catch (error) {
      asLinkerError(error);
    }
  }

  private async connect(token: string): Promise<SessionState> {
    const info = await this.client.connect(token);
    // Ya estaba vinculada: el número sale del estado.
    if (info.status === "connected") return toState(info.phoneNumber ? info : await this.client.status(token));
    return { kind: "qr", qrImage: info.qrcode };
  }
}
