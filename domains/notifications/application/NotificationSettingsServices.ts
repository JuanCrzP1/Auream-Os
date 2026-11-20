import type { NotificationSettingsResponse, PushTopic, SubscribePushRequest, SubscribePushResponse } from "../../../contracts/NotificationSettingsContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { testMessage } from "../domain/PushMessages";
import { deviceLabel, isPushServiceEndpoint } from "../domain/pushEndpoint";
import type { PushDeviceStore, PushPreferenceStore, PushSender } from "./PushPorts";
import { isPushTopic, topicsFor } from "./pushTopicRules";

// ---------------------------------------------------------------------------
// Configuración › Tu cuenta › Notificaciones: los dispositivos de la persona
// (activar, quitar, probar) y qué le suena en esta empresa. Cada uno ve y
// cambia solo lo suyo.
// ---------------------------------------------------------------------------

export interface NotificationActor {
  readonly tenantId: string;
  readonly userId: string;
  /** Sus permisos en esta empresa: deciden qué avisos se le ofrecen. */
  readonly scopes: ReadonlyArray<string>;
}

const KEY = /^[A-Za-z0-9_-]+=*$/;

export class NotificationSettingsServices {
  public constructor(
    private readonly devices: PushDeviceStore,
    private readonly preferences: PushPreferenceStore,
    private readonly sender: PushSender | null,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async view(actor: NotificationActor): Promise<NotificationSettingsResponse> {
    const [devices, chosen] = await Promise.all([this.devices.listForUser(actor.userId), this.preferences.get(actor.tenantId, actor.userId)]);
    return {
      push: { available: this.sender !== null, publicKey: this.sender?.publicKey ?? null },
      devices: devices.map((device) => ({ id: device.id, label: device.label || "Dispositivo", createdAt: device.createdAt, lastUsedAt: device.lastUsedAt })),
      topics: topicsFor(actor.scopes).map((topic) => ({ topic, enabled: chosen.get(topic) ?? true }))
    };
  }

  public async setTopic(actor: NotificationActor, topic: unknown, enabled: unknown): Promise<NotificationSettingsResponse> {
    if (!isPushTopic(topic) || !topicsFor(actor.scopes).includes(topic)) throw new NotFoundError("Ese aviso no existe.");
    if (typeof enabled !== "boolean") throw new ValidationError("Di si el aviso queda prendido o apagado.");
    await this.preferences.set(actor.tenantId, actor.userId, topic as PushTopic, enabled, this.now());
    return this.view(actor);
  }

  public async subscribe(actor: NotificationActor, request: Partial<SubscribePushRequest>): Promise<SubscribePushResponse> {
    if (!this.sender) throw new ValidationError("Los avisos al celular todavía no están activos en Auream.");
    const endpoint = typeof request.endpoint === "string" ? request.endpoint.trim() : "";
    const p256dh = typeof request.keys?.p256dh === "string" ? request.keys.p256dh : "";
    const auth = typeof request.keys?.auth === "string" ? request.keys.auth : "";
    if (endpoint.length > 1000 || !isPushServiceEndpoint(endpoint)) throw new ValidationError("Este navegador no entregó una dirección de avisos válida.");
    if (!KEY.test(p256dh) || p256dh.length < 20 || p256dh.length > 200 || !KEY.test(auth) || auth.length < 8 || auth.length > 100) {
      throw new ValidationError("Este navegador no entregó las claves de avisos.");
    }
    const deviceId = await this.devices.save({ userId: actor.userId, endpoint, p256dh, auth, label: deviceLabel(request.label) });
    return { deviceId };
  }

  public async removeDevice(actor: NotificationActor, deviceId: string): Promise<NotificationSettingsResponse> {
    if (!(await this.devices.remove(actor.userId, deviceId))) throw new NotFoundError("Ese dispositivo no existe.");
    return this.view(actor);
  }

  /** «Enviar una prueba» a uno de sus dispositivos. */
  public async test(actor: NotificationActor, deviceId: string): Promise<{ readonly sent: boolean }> {
    if (!this.sender) throw new ValidationError("Los avisos al celular todavía no están activos en Auream.");
    const device = (await this.devices.listForUser(actor.userId)).find((candidate) => candidate.id === deviceId);
    if (!device) throw new NotFoundError("Ese dispositivo no existe.");
    const result = await this.sender.send(device, testMessage());
    if (result === "gone") {
      await this.devices.forget(device.id);
      throw new ValidationError("Ese dispositivo ya no recibe avisos (se quitó el permiso o se borró el navegador). Vuelve a activarlos ahí.");
    }
    if (result === "sent") await this.devices.touch(device.id, this.now());
    return { sent: result === "sent" };
  }
}
