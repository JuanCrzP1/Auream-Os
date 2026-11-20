import type { MoneyAmount } from "../../../contracts/BroadcastResultsContracts";
import type { GroupMemberFilter } from "../../../contracts/GroupMemberContracts";

// ---------------------------------------------------------------------------
// Lo que la lista de miembros necesita leer. Todo por cuenta y por grupo; solo
// los miembros con número visible. «Compró» es la MISMA regla que los números
// del grupo (una venta aprobada mientras estaba en él).
//
// Los filtros:
//   all        están en el grupo
//   buyers     compraron mientras estaban (sigan o no)
//   nonBuyers  están y no han comprado (nunca tus números)
//   left       se fueron
//   admins     están y son administradores
// ---------------------------------------------------------------------------

export interface MemberRow {
  readonly key: string;
  readonly name: string | null;
  readonly phone: string;
  readonly contactId: string | null;
  readonly isAdmin: boolean;
  readonly isOwnNumber: boolean;
  /** `null` si ya estaba cuando se trajo el grupo por primera vez. */
  readonly joinedAt: string | null;
  readonly leftAt: string | null;
  /** Lo que compró mientras estaba, por moneda (de mayor a menor). */
  readonly bought: ReadonlyArray<MoneyAmount>;
}

export interface MemberQuery {
  readonly filter: GroupMemberFilter;
  /** Nombre o parte del número; `null`: todos. */
  readonly search: string | null;
  readonly offset: number;
  readonly limit: number;
}

export interface MemberPage {
  readonly rows: ReadonlyArray<MemberRow>;
  /** Cuántos hay en cada filtro (con la búsqueda aplicada). */
  readonly counts: Readonly<Record<GroupMemberFilter, number>>;
  /** Están en el grupo sin número visible. */
  readonly hidden: number;
}

export interface GroupMemberReader {
  /** Los más nuevos primero (los que se fueron, por cuándo se fueron). */
  page(tenantId: string, groupId: string, query: MemberQuery): Promise<MemberPage>;
  /**
   * Los números del filtro que aún no tienen la etiqueta (sin importar
   * mayúsculas), nunca tus números: hasta `limit`, y cuántos son en total.
   */
  toLabel(tenantId: string, groupId: string, filter: GroupMemberFilter, label: string, limit: number): Promise<{ readonly phones: ReadonlyArray<string>; readonly total: number }>;
}
