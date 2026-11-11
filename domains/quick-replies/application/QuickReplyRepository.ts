import type { QuickReply, QuickReplyPiece } from "../../../contracts/QuickReplyContracts";

// Dónde viven las respuestas rápidas de cada cuenta; la composición decide cuál.

export interface NewQuickReply {
  readonly id: string;
  readonly tenantId: string;
  readonly shortcut: string;
  readonly pieces: ReadonlyArray<QuickReplyPiece>;
  readonly createdBy: string;
}

export interface QuickReplyRepository {
  /** Todas las de la cuenta: las más usadas hace poco primero, luego por atajo. */
  list(tenantId: string): Promise<QuickReply[]>;
  count(tenantId: string): Promise<number>;
  findByShortcut(tenantId: string, shortcut: string): Promise<QuickReply | null>;
  create(reply: NewQuickReply): Promise<QuickReply>;
  /** `null` si no existe en esa cuenta. */
  update(tenantId: string, id: string, changes: { readonly shortcut: string; readonly pieces: ReadonlyArray<QuickReplyPiece> }): Promise<QuickReply | null>;
  remove(tenantId: string, id: string): Promise<boolean>;
  /** Suma un uso (ordena la lista por lo que el equipo usa). */
  markUsed(tenantId: string, id: string): Promise<void>;
}
