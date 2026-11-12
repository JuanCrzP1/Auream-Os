import type { SalesLine, SalesLineDraft } from "../domain/SalesLine";

/** Las líneas de venta de cada cuenta. Todo filtra por cuenta. */
export interface SalesLineRepository {
  list(tenantId: string): Promise<SalesLine[]>;
  find(tenantId: string, id: string): Promise<SalesLine | null>;
  count(tenantId: string): Promise<number>;
  /** ¿Otra línea de la cuenta ya se llama así (sin importar mayúsculas)? */
  nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean>;
  create(tenantId: string, id: string, draft: SalesLineDraft): Promise<SalesLine>;
  /** `null` si no existe en esa cuenta. */
  update(tenantId: string, id: string, draft: SalesLineDraft): Promise<SalesLine | null>;
  /** `true` si existía. */
  remove(tenantId: string, id: string): Promise<boolean>;
}
