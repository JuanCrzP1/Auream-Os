import type { MoneyAmount } from "./BroadcastResultsContracts";

// ---------------------------------------------------------------------------
// Los miembros de un grupo: quién está, quién se fue y quién compró mientras
// estaba (la MISMA regla que los números del grupo y de la campaña). Solo los
// que tienen número visible se listan; WhatsApp oculta el de algunos y esos
// se cuentan aparte (`hidden`). Con ellos se puede actuar: ponerles una
// etiqueta (por tandas) o descargarlos (dueños y administradores, queda
// registrado quién descargó).
// ---------------------------------------------------------------------------

export const GROUP_MEMBER_FILTERS = ["all", "buyers", "nonBuyers", "left", "admins"] as const;
export type GroupMemberFilter = (typeof GROUP_MEMBER_FILTERS)[number];

/** Miembros por página. */
export const GROUP_MEMBERS_PAGE = 100;
/**
 * A cuántos se les pone la etiqueta por petición (la web sigue sola hasta
 * terminar). Cada persona son varias consultas (crear el contacto si falta,
 * la etiqueta y el CRM): 50 deja cada petición muy lejos del límite de la
 * función y el avance se ve seguido.
 */
export const GROUP_LABEL_BATCH = 50;
/** Tope de filas de la descarga (un grupo tiene hasta 1.024, más los que salieron). */
export const GROUP_MEMBERS_EXPORT_MAX = 5000;

export interface GroupMemberView {
  /** Identificador del miembro en el grupo (sirve de clave en la lista). */
  readonly key: string;
  /** Su nombre si ya es contacto de la cuenta. */
  readonly name: string | null;
  /** Solo dígitos, con indicativo. */
  readonly phone: string;
  readonly contactId: string | null;
  readonly isAdmin: boolean;
  /** Es uno de tus números conectados: nunca se cuenta como «no compró» ni se etiqueta. */
  readonly isOwnNumber: boolean;
  /** Cuándo entró; `null` si ya estaba cuando Auream trajo el grupo por primera vez. */
  readonly joinedAt: string | null;
  readonly leftAt: string | null;
  /** Lo que compró mientras estaba en el grupo, por moneda. `null`: sin permiso de ver ventas. */
  readonly bought: ReadonlyArray<MoneyAmount> | null;
}

export interface GroupMembersPage {
  readonly group: {
    readonly id: string;
    readonly name: string;
    readonly position: number | null;
    readonly connectionName: string;
    /** Los que dice WhatsApp (el mismo número de la tarjeta del grupo). */
    readonly members: number;
    readonly syncedAt: string | null;
  };
  /** Cuántos hay en cada filtro (con la búsqueda aplicada). */
  readonly counts: Readonly<Record<GroupMemberFilter, number>>;
  /** Están en el grupo pero WhatsApp no muestra su número: no se listan ni se cruzan con ventas. */
  readonly hidden: number;
  /** Lo vendido a los miembros, igual que la tarjeta del grupo. `null`: sin permiso de ver ventas. */
  readonly revenue: ReadonlyArray<MoneyAmount> | null;
  readonly members: ReadonlyArray<GroupMemberView>;
  readonly nextOffset: number | null;
  /** Puede etiquetarlos (grupos y contactos para editar). */
  readonly canLabel: boolean;
  /** Puede descargarlos (dueños y administradores). */
  readonly canExport: boolean;
}

export interface LabelGroupMembersRequest {
  readonly filter: GroupMemberFilter;
  /** Nombre de la etiqueta (se crea si no existe), hasta 40 caracteres. */
  readonly label: string;
}

export interface LabelGroupMembersResponse {
  readonly label: string;
  /** Etiquetados en esta tanda. */
  readonly labeled: number;
  /** Los que faltan (sin la etiqueta todavía). */
  readonly remaining: number;
}
