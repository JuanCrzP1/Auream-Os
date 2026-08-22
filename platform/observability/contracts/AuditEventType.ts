// Tipos canónicos de eventos de auditoría.
// Cada tipo corresponde a una operación significativa del dominio.
export type AuditEventType =
  | "flow.published"
  | "flow.rolled_back"
  | "draft.saved"
  | "auth.succeeded"
  | "auth.failed"
  | "access.denied"
  | "access.granted"
  | "subscription.changed"
  | "version.activated";
