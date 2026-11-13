import type { BusinessDatum } from "../../../contracts/BusinessDataContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { DatumShape } from "../domain/BusinessDatum";
import type { BroadcastText, QuickReplyText } from "../domain/businessDataUses";

// Lo que el módulo de Datos del negocio necesita de fuera (la base, los flujos,
// las difusiones y las respuestas rápidas).

export interface BusinessDataRepository {
  list(tenantId: string): Promise<BusinessDatum[]>;
  find(tenantId: string, id: string): Promise<BusinessDatum | null>;
  /** `null` si la clave ya existe en la cuenta. */
  create(tenantId: string, id: string, datum: DatumShape, actorId: string): Promise<BusinessDatum | null>;
  update(tenantId: string, id: string, datum: DatumShape, actorId: string): Promise<BusinessDatum | null>;
  remove(tenantId: string, id: string): Promise<boolean>;
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
