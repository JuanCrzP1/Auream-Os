import type { NotificationKind } from "../../../contracts/NotificationContracts";
import type { Signal } from "../domain/Signal";

// Lo que Notificaciones necesita de fuera: leer el estado de los módulos y
// recordar hasta cuándo vio cada persona sus avisos.

export interface SignalQuery {
  readonly tenantId: string;
  readonly userId: string;
  /** Solo lo que la persona puede ver según sus permisos. */
  readonly kinds: ReadonlySet<NotificationKind>;
  readonly timezone: string;
  readonly now: Date;
}

export interface SignalSource {
  read(query: SignalQuery): Promise<ReadonlyArray<Signal>>;
}

export interface NotificationReads {
  seenAt(tenantId: string, userId: string): Promise<Date | null>;
  markSeen(tenantId: string, userId: string, at: Date): Promise<void>;
}
