import webpush from "web-push";
import type { PushResult, PushSender, StoredPushDevice } from "../../domains/notifications/application/PushPorts";
import type { PushMessage } from "../../domains/notifications/domain/PushMessages";

// ---------------------------------------------------------------------------
// WebPushSender — manda el aviso al servicio de avisos del navegador (Google,
// Mozilla, Apple, Microsoft) con el estándar Web Push y las claves VAPID de la
// plataforma. El contenido va cifrado para ese dispositivo: el servicio no lo
// puede leer.
//
//   · 404/410: el dispositivo ya no existe (se quitó el permiso, se borró el
//     navegador) → «gone», para olvidarlo.
//   · Cualquier otro error → «failed» (se reintenta con el próximo aviso).
//   · TTL de 1 hora: un aviso de hace más de una hora ya no sirve.
// ---------------------------------------------------------------------------

export interface VapidKeys {
  readonly publicKey: string;
  readonly privateKey: string;
  /** `mailto:` o `https:` de contacto que exige el estándar. */
  readonly subject: string;
}

const TTL_SECONDS = 3600;
const TIMEOUT_MS = 10_000;

export class WebPushSender implements PushSender {
  public readonly publicKey: string;

  public constructor(private readonly keys: VapidKeys) {
    this.publicKey = keys.publicKey;
  }

  public async send(device: StoredPushDevice, message: PushMessage): Promise<PushResult> {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(message),
        { vapidDetails: { subject: this.keys.subject, publicKey: this.keys.publicKey, privateKey: this.keys.privateKey }, TTL: TTL_SECONDS, urgency: "high", timeout: TIMEOUT_MS }
      );
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? "gone" : "failed";
    }
  }
}
