// ---------------------------------------------------------------------------
// Configuración › Tu cuenta › Notificaciones: los avisos que suenan en el
// celular o el computador aunque Auream esté cerrado (Web Push). Cada persona
// los activa en cada dispositivo y elige qué le suena, por empresa.
// ---------------------------------------------------------------------------

export const PUSH_TOPICS = ["chat_message", "number_disconnected", "sale_review", "follow_up_due"] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

/** Un celular o computador donde la persona activó los avisos. */
export interface PushDevice {
  readonly id: string;
  /** «Chrome en Mac», «Safari en iPhone». */
  readonly label: string;
  readonly createdAt: string;
  /** El último aviso que le llegó; `null` si todavía ninguno. */
  readonly lastUsedAt: string | null;
}

export interface PushTopicSetting {
  readonly topic: PushTopic;
  readonly enabled: boolean;
}

export interface NotificationSettingsResponse {
  readonly push: {
    /** El servidor puede mandar avisos (tiene sus claves). Si no, la página lo explica. */
    readonly available: boolean;
    /** La clave pública que pide el navegador para suscribirse. */
    readonly publicKey: string | null;
  };
  readonly devices: ReadonlyArray<PushDevice>;
  /** Solo los avisos que esta persona puede recibir en esta empresa (por su rol). */
  readonly topics: ReadonlyArray<PushTopicSetting>;
}

/** Lo que entrega el navegador al suscribirse (`PushSubscription.toJSON()`), más el nombre del dispositivo. */
export interface SubscribePushRequest {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
  readonly label?: string;
}

export interface SubscribePushResponse {
  readonly deviceId: string;
}
