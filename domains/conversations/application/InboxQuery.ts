import type { ConversationFilter, ConversationListQuery, ConversationSummary } from "../../../contracts/ConversationContracts";
import { CONVERSATION_FILTERS, MAX_LABEL_FILTERS } from "../../../contracts/ConversationContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { InboxCursor, InboxQuery } from "./ConversationRepository";

// ---------------------------------------------------------------------------
// Los filtros de la bandeja tal como llegan de la URL (texto libre), validados,
// y el cursor de páginas (opaco para la web).
// ---------------------------------------------------------------------------

/** El cursor viaja opaco (base64url): la web solo lo devuelve tal cual. */
export function encodeCursor(summary: ConversationSummary): string {
  const cursor: InboxCursor = { activityAt: summary.lastMessageAt ?? summary.createdAt, id: summary.id };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string): InboxCursor {
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<InboxCursor>;
    if (typeof value.activityAt === "string" && !Number.isNaN(Date.parse(value.activityAt)) && typeof value.id === "string" && value.id.length <= 64) {
      return { activityAt: value.activityAt, id: value.id };
    }
  } catch {
    // cae al error de abajo
  }
  throw new ValidationError("La página pedida no es válida. Vuelve a cargar la bandeja.");
}

function isoDate(value: string | undefined, label: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new ValidationError(`La fecha «${label}» no es válida.`);
  return new Date(time).toISOString();
}

/** Filtros de la bandeja validados (lo que llega de la URL es texto libre). */
export function inboxQuery(query: ConversationListQuery): Omit<InboxQuery, "limit"> {
  const filter: ConversationFilter = query.filter && CONVERSATION_FILTERS.includes(query.filter) ? query.filter : "all";
  const labelIds = [...new Set((query.labelIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (labelIds.length > MAX_LABEL_FILTERS) throw new ValidationError(`Filtra por hasta ${MAX_LABEL_FILTERS} etiquetas a la vez.`);
  if (labelIds.some((id) => id.length > 64)) throw new ValidationError("Una de las etiquetas no es válida.");
  const from = isoDate(query.from, "desde");
  const to = isoDate(query.to, "hasta");
  if (from && to && from >= to) throw new ValidationError("La fecha «desde» debe ser anterior a «hasta».");
  const search = query.search?.trim().slice(0, 80);
  return {
    filter,
    ...(search ? { search } : {}),
    ...(query.connectionId ? { connectionId: query.connectionId } : {}),
    ...(labelIds.length ? { labelIds } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(query.cursor ? { after: decodeCursor(query.cursor) } : {})
  };
}
