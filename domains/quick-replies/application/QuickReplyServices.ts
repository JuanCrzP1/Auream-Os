import { randomUUID } from "node:crypto";
import { MAX_QUICK_REPLIES, type QuickReply } from "../../../contracts/QuickReplyContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { checkPieces, checkShortcut, type Checked } from "../domain/QuickReply";
import type { QuickReplyRepository } from "./QuickReplyRepository";

// ---------------------------------------------------------------------------
// Respuestas rápidas: el catálogo de mensajes guardados de la cuenta que el
// equipo pone en el chat (atajo + piezas). Todo filtra por cuenta. El atajo
// es único en la cuenta («/saludo» siempre trae la misma).
// ---------------------------------------------------------------------------

function valueOf<T>(checked: Checked<T>): T {
  if (!checked.ok) throw new ValidationError(checked.problem);
  return checked.value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class QuickReplyServices {
  public constructor(private readonly repository: QuickReplyRepository) {}

  public list(tenantId: string): Promise<QuickReply[]> {
    return this.repository.list(tenantId);
  }

  public async create(tenantId: string, userId: string, input: { readonly shortcut?: unknown; readonly pieces?: unknown }): Promise<QuickReply> {
    const shortcut = valueOf(checkShortcut(input.shortcut));
    const pieces = valueOf(checkPieces(input.pieces));
    if ((await this.repository.count(tenantId)) >= MAX_QUICK_REPLIES) {
      throw new ValidationError(`La cuenta ya tiene ${MAX_QUICK_REPLIES} respuestas rápidas. Borra las que no uses.`);
    }
    await this.ensureFree(tenantId, shortcut);
    return this.repository.create({ id: randomUUID(), tenantId, shortcut, pieces, createdBy: userId });
  }

  public async update(tenantId: string, id: string, input: { readonly shortcut?: unknown; readonly pieces?: unknown }): Promise<QuickReply> {
    const shortcut = valueOf(checkShortcut(input.shortcut));
    const pieces = valueOf(checkPieces(input.pieces));
    await this.ensureFree(tenantId, shortcut, id);
    const updated = UUID.test(id) ? await this.repository.update(tenantId, id, { shortcut, pieces }) : null;
    if (!updated) throw new NotFoundError("Esa respuesta rápida ya no existe.");
    return updated;
  }

  public async remove(tenantId: string, id: string): Promise<void> {
    if (!UUID.test(id) || !(await this.repository.remove(tenantId, id))) throw new NotFoundError("Esa respuesta rápida ya no existe.");
  }

  /** El equipo la usó en un chat (las más usadas suben en la lista). */
  public async markUsed(tenantId: string, id: string): Promise<void> {
    if (UUID.test(id)) await this.repository.markUsed(tenantId, id);
  }

  private async ensureFree(tenantId: string, shortcut: string, exceptId?: string): Promise<void> {
    const existing = await this.repository.findByShortcut(tenantId, shortcut);
    if (existing && existing.id !== exceptId) throw new ValidationError(`Ya tienes una respuesta rápida con el atajo «${shortcut}».`);
  }
}
