import type { PushTopic } from "../../../contracts/NotificationSettingsContracts";
import { chatMessage, followUpDue, numberDisconnected, saleReview, type PushMessage } from "../domain/PushMessages";
import type { PushAudience, PushDeviceStore, PushPreferenceStore, PushSender } from "./PushPorts";
import { roleReceives } from "./pushTopicRules";

// ---------------------------------------------------------------------------
// PushNotifier — un evento de la cuenta → el aviso en los dispositivos de
// quien debe enterarse:
//
//   1. a quién le toca (el que atiende el chat, a quien se le asignó el
//      seguimiento, o el equipo con el permiso de resolverlo);
//   2. de ellos, quién no lo apagó en esta empresa;
//   3. a cada uno de sus dispositivos; si el servicio dice que un dispositivo
//      ya no existe, se olvida.
//
// Nunca lanza: un aviso que no sale no puede frenar la atención de un chat ni
// un flujo. Los módulos no lo conocen: la composición lo conecta a sus eventos.
// ---------------------------------------------------------------------------

export type PushEvent =
  | { readonly topic: "chat_message"; readonly tenantId: string; readonly connectionId: string; readonly phone: string; readonly kind: string; readonly text: string }
  | { readonly topic: "number_disconnected"; readonly tenantId: string; readonly connectionId: string }
  | { readonly topic: "sale_review"; readonly tenantId: string; readonly saleId: string; readonly customerName: string | null; readonly amount: string | null; readonly reason: string | null; readonly recordedBy: string | null }
  | { readonly topic: "follow_up_due"; readonly tenantId: string; readonly followUpId: string; readonly dueAt: string };

interface Target {
  readonly message: PushMessage;
  readonly userIds: ReadonlyArray<string>;
}

export interface PushNotifierDependencies {
  readonly devices: PushDeviceStore;
  readonly preferences: PushPreferenceStore;
  readonly audience: PushAudience;
  /** `null`: el servidor no tiene las claves de avisos (no se manda nada). */
  readonly sender: PushSender | null;
  readonly onError: (error: unknown, context: Record<string, unknown>) => void;
  readonly now?: () => Date;
}

export class PushNotifier {
  public constructor(private readonly deps: PushNotifierDependencies) {}

  /** Cuántos dispositivos recibieron el aviso. */
  public async notify(event: PushEvent): Promise<number> {
    const { sender } = this.deps;
    if (!sender) return 0;
    try {
      const target = await this.target(event);
      if (!target || target.userIds.length === 0) return 0;
      const muted = await this.deps.preferences.mutedAmong(event.tenantId, event.topic, target.userIds);
      const devices = await this.deps.devices.listForUsers(target.userIds.filter((userId) => !muted.has(userId)));
      const at = (this.deps.now ?? (() => new Date()))();
      const results = await Promise.all(
        devices.map(async (device) => {
          const result = await sender.send(device, target.message);
          if (result === "gone") await this.deps.devices.forget(device.id);
          if (result === "sent") await this.deps.devices.touch(device.id, at);
          return result;
        })
      );
      return results.filter((result) => result === "sent").length;
    } catch (error) {
      this.deps.onError(error, { step: "push.notify", topic: event.topic, tenantId: event.tenantId });
      return 0;
    }
  }

  private async target(event: PushEvent): Promise<Target | null> {
    const { audience } = this.deps;
    switch (event.topic) {
      case "chat_message": {
        const chat = await audience.chatAttendant(event.tenantId, event.connectionId, event.phone);
        if (!chat) return null;
        return { message: chatMessage({ ...event, contactName: chat.contactName, conversationId: chat.conversationId }), userIds: await this.allowed(event.tenantId, event.topic, [chat.assigneeId]) };
      }
      case "number_disconnected": {
        const name = (await audience.connectionName(event.tenantId, event.connectionId)) ?? "Tu número";
        return { message: numberDisconnected({ connectionId: event.connectionId, connectionName: name }), userIds: await this.allowed(event.tenantId, event.topic, null) };
      }
      case "sale_review": {
        // Quien la anotó a mano ya sabe que quedó por revisar.
        const userIds = (await this.allowed(event.tenantId, event.topic, null)).filter((userId) => userId !== event.recordedBy);
        return { message: saleReview(event), userIds };
      }
      case "follow_up_due": {
        const followUp = await audience.followUp(event.tenantId, event.followUpId);
        // Ya se hizo, se borró o se movió de hora: este aviso ya no corresponde.
        if (!followUp || followUp.doneAt || followUp.dueAt !== event.dueAt || !followUp.assigneeId) return null;
        return { message: followUpDue({ followUpId: event.followUpId, title: followUp.title, contactName: followUp.contactName }), userIds: await this.allowed(event.tenantId, event.topic, [followUp.assigneeId]) };
      }
    }
  }

  /** Las personas activas de la empresa que pueden recibir el aviso (de `only`, si se dice). */
  private async allowed(tenantId: string, topic: PushTopic, only: ReadonlyArray<string> | null): Promise<ReadonlyArray<string>> {
    const members = await this.deps.audience.members(tenantId);
    return members.filter((member) => roleReceives(member.role, topic) && (only === null || only.includes(member.userId))).map((member) => member.userId);
  }
}
