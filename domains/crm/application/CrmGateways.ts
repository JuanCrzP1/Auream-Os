import type { ProductPrice } from "../../../contracts/SalesContracts";

// ---------------------------------------------------------------------------
// Lo que el CRM necesita de OTROS módulos, por puertos (nunca importando sus
// dominios). La composición (`apps/api/composition/composeCrmServices.ts`)
// decide quién los cumple.
// ---------------------------------------------------------------------------

/** Cómo se movió una etiqueta: lo guarda el historial. */
export interface LabelOrigin {
  readonly kind: "flow" | "user" | "sale" | "auto";
  readonly userId?: string | null;
  readonly flowKey?: string | null;
  /** Una nota para el historial (por qué no compró). */
  readonly note?: string | null;
}

/** Lo que el CRM lee de un contacto. */
export interface ContactSnapshot {
  readonly phone: string | null;
  readonly labelIds: ReadonlyArray<string>;
  /** Llegó por un anuncio (Click to WhatsApp). */
  readonly fromAd: boolean;
}

/** Contactos: poner y quitar etiquetas (así se mueve un cliente de etapa). */
export interface ContactLabeler {
  /** El contacto de la cuenta, o `null` si no existe. */
  snapshot(tenantId: string, contactId: string): Promise<ContactSnapshot | null>;
  change(tenantId: string, contactId: string, change: { add: ReadonlyArray<string>; remove: ReadonlyArray<string> }, origin: LabelOrigin): Promise<void>;
}

/** Contactos: el catálogo de etiquetas (cada etapa es una). */
export interface StageLabels {
  /** La etiqueta con ese nombre (sin distinguir mayúsculas); si no existe, la crea. */
  ensure(tenantId: string, name: string, color: string | null): Promise<{ id: string; name: string; color: string }>;
  find(tenantId: string, labelId: string): Promise<{ id: string; name: string; color: string } | null>;
  /** Renombrar o recolorear la etapa = la etiqueta. */
  update(tenantId: string, labelId: string, name: string, color: string): Promise<void>;
}

/** Productos: el valor por defecto de quien entra (su precio en el país del cliente). */
export interface CrmProductCatalog {
  findActive(tenantId: string, productId: string | null | undefined): Promise<{ id: string; name: string; prices: ReadonlyArray<ProductPrice> } | null>;
}

export interface CrmTeamMember {
  readonly userId: string;
  readonly name: string;
  readonly photoUrl: string | null;
  /** Puede atender clientes (no es «Solo lectura»). */
  readonly canSell: boolean;
}

/** Equipo: quién puede ser responsable. */
export interface CrmTeamDirectory {
  members(tenantId: string): Promise<ReadonlyArray<CrmTeamMember>>;
}

/** Turnos del reparto automático (el mismo contador del bloque Distribuidor). */
export interface TurnCounter {
  next(tenantId: string, key: string): Promise<number>;
}
