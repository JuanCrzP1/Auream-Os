import type { BusinessDatum } from "../../../contracts/BusinessDataContracts";
import type { BusinessDataChange, BusinessDataChangeDetail } from "../../../contracts/BusinessDataTimeline";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { DatumShape } from "../domain/BusinessDatum";
import type { ScheduleShape } from "../domain/DatumSchedule";
import type { BroadcastText, QuickReplyText } from "../domain/businessDataUses";

// Lo que el módulo de Datos del negocio necesita de fuera (la base, los flujos,
// las difusiones, las respuestas rápidas y la zona horaria de la empresa).

/** Lo que se anota en el historial junto con un cambio, en la misma operación: nunca un cambio sin su línea. */
export interface DatumLog {
  readonly actorId: string;
  readonly changes: ReadonlyArray<BusinessDataChangeDetail>;
}

export type ScheduleSaved = "saved" | "missing" | "overlap";

/** Todo filtra por cuenta. Los datos llegan con sus cambios programados por venir o activos. */
export interface BusinessDataRepository {
  list(tenantId: string): Promise<BusinessDatum[]>;
  find(tenantId: string, id: string): Promise<BusinessDatum | null>;
  /** `null` si la clave ya existe en la cuenta. */
  create(tenantId: string, id: string, datum: DatumShape, log: DatumLog): Promise<BusinessDatum | null>;
  update(tenantId: string, id: string, datum: DatumShape, log: DatumLog): Promise<BusinessDatum | null>;
  remove(tenantId: string, id: string, log: DatumLog): Promise<boolean>;
  /**
   * Crea o cambia un programado del dato. Con el dato bloqueado vuelve a
   * mirar que no se cruce con otro (dos personas a la vez): `overlap`.
   */
  saveSchedule(tenantId: string, datumId: string, scheduleId: string, schedule: ScheduleShape, log: DatumLog): Promise<ScheduleSaved>;
  /** Quita uno que no ha empezado, o termina en `at` uno activo. `false` si ya no estaba. */
  closeSchedule(tenantId: string, datumId: string, scheduleId: string, how: "unscheduled" | "ended", at: Date, log: DatumLog): Promise<boolean>;
  /** Lo último que pasó con esa clave, del más reciente al más viejo. */
  history(tenantId: string, key: string, limit: number): Promise<BusinessDataChange[]>;
}

/** Los textos que pueden usar un dato: flujos que corren, difusiones por enviar y respuestas rápidas. */
export interface BusinessDataTexts {
  flows(tenantId: string): Promise<ReadonlyArray<BuilderFlowSnapshot>>;
  broadcasts(tenantId: string): Promise<ReadonlyArray<BroadcastText>>;
  quickReplies(tenantId: string): Promise<ReadonlyArray<QuickReplyText>>;
}

/** Avisa que los valores de una cuenta cambiaron (el motor deja de usar los que tenía guardados). */
export interface BusinessValuesCache {
  forget(tenantId: string): void;
}

export interface BusinessDataClock {
  readonly newId?: () => string;
  readonly now?: () => Date;
  /** Zona horaria de la empresa (IANA): la de los cambios programados. */
  readonly timeZoneOf?: (tenantId: string) => Promise<string>;
}
