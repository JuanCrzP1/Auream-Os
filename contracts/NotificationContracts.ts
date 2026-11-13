// ---------------------------------------------------------------------------
// Notificaciones (la campana del menú): lo que pide atención en la cuenta,
// leído del estado de cada módulo. Cada aviso lleva a la pantalla donde se
// resuelve y desaparece cuando ya no aplica. Contrato entre API y web.
// (No confundir con `NotificationConfig`: el bloque de flujo que avisa por WhatsApp.)
// ---------------------------------------------------------------------------

export const NOTIFICATION_KINDS = ["number_disconnected", "broadcast_auto_paused", "sales_review", "follow_ups_due", "group_created", "flow_failures"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AppNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly detail: string;
  /** La pantalla donde se resuelve (`/connections`, `/sales?tab=review`…). */
  readonly path: string;
  readonly occurredAt: string;
  /** Pasó después de la última vez que la persona abrió la campana. */
  readonly unread: boolean;
}

export interface NotificationFeed {
  readonly items: ReadonlyArray<AppNotification>;
  readonly unread: number;
}
