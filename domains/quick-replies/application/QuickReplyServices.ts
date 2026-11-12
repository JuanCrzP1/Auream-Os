import { randomUUID } from "node:crypto";
import { MAX_QUICK_REPLIES, type QuickReply } from "../../../contracts/QuickReplyContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { checkCategory, checkPieces, checkShortcut, type Checked } from "../domain/QuickReply";
import type { QuickReplyChanges, QuickReplyRepository } from "./QuickReplyRepository";

// ---------------------------------------------------------------------------
// Respuestas rápidas: el catálogo de mensajes guardados de la cuenta que el
// equipo pone en el chat (atajo, categoría y piezas). Todo filtra por
// cuenta. El atajo es único en la cuenta («/saludo» siempre trae la misma).
// ---------------------------------------------------------------------------

type Input = { readonly shortcut?: unknown; readonly category?: unknown; readonly pieces?: unknown };

function valueOf<T>(checked: Checked<T>): T {
  if (!checked.ok) throw new ValidationError(checked.problem);
  return checked.value;
}

function checked(input: Input): QuickReplyChanges {
  return { shortcut: valueOf(checkShortcut(input.shortcut)), category: valueOf(checkCategory(input.category)), pieces: valueOf(checkPieces(input.pieces)) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class QuickReplyServices {
  public constructor(private readonly repository: QuickReplyRepository) {}

  public list(tenantId: string): Promise<QuickReply[]> {
    return this.repository.list(tenantId);
  }

  public async create(tenantId: string, userId: string, input: Input): Promise<QuickReply> {
    const changes = await this.sameCategory(tenantId, checked(input));
    if ((await this.repository.count(tenantId)) >= MAX_QUICK_REPLIES) {
      throw new ValidationError(`La cuenta ya tiene ${MAX_QUICK_REPLIES} respuestas rápidas. Borra las que no uses.`);
    }
    await this.ensureFree(tenantId, changes.shortcut);
    return this.repository.create({ id: randomUUID(), tenantId, ...changes, createdBy: userId });
  }

  public async update(tenantId: string, id: string, input: Input): Promise<QuickReply> {
    const changes = await this.sameCategory(tenantId, checked(input));
    await this.ensureFree(tenantId, changes.shortcut, id);
    const updated = UUID.test(id) ? await this.repository.update(tenantId, id, changes) : null;
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

  /** «precios» y «Precios» son la misma categoría: se usa como ya está escrita en la cuenta. */
  private async sameCategory(tenantId: string, changes: QuickReplyChanges): Promise<QuickReplyChanges> {
    if (!changes.category) return changes;
    const wanted = changes.category.toLocaleLowerCase("es");
    const existing = (await this.repository.list(tenantId)).find((reply) => reply.category?.toLocaleLowerCase("es") === wanted)?.category;
    return existing ? { ...changes, category: existing } : changes;
  }

  private async ensureFree(tenantId: string, shortcut: string, exceptId?: string): Promise<void> {
    const existing = await this.repository.findByShortcut(tenantId, shortcut);
    if (existing && existing.id !== exceptId) throw new ValidationError(`Ya tienes una respuesta rápida con el atajo «${shortcut}».`);
  }
}
