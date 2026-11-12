import type { ToolCompactProps } from "../ToolUi";
import type { MessageMediaItem, MessageItem, MessageTextItem } from "./types";
import { MESSAGE_ITEM_LABELS } from "./messageItems";
import { readMessageItems } from "./readMessageConfig";
import { MediaBlockThumbnail } from "./MediaBlockThumbnail";
import { EMPTY_PREVIEW_TEXT, isContentItem } from "./validateMessageContent";
import { getItemIcon } from "./editor/itemIcons";

type ContentItem = MessageTextItem | MessageMediaItem;

function isContent(item: MessageItem): item is ContentItem {
  return isContentItem(item);
}

/** El nombre del archivo: el que se guardó al subirlo o, si no, el del final del enlace (si parece un nombre con extensión). */
export function mediaName(item: MessageMediaItem): string | null {
  const saved = item.fileName?.trim();
  if (saved) return saved;
  try {
    const last = decodeURIComponent(new URL(item.url).pathname.split("/").pop() ?? "");
    return /\.[a-z0-9]{2,5}$/i.test(last) ? last : null;
  } catch {
    return null;
  }
}

/**
 * Una línea por bloque: el texto escrito (normalizado a una fila) o, para un
 * documento o un audio, su NOMBRE («catalogo.pdf»), que es lo que dice qué
 * se envía. Una imagen o un video se reconocen por su miniatura: llevan su
 * tipo. Sin nombre conocido, el tipo.
 */
function describe(item: ContentItem): string {
  if (item.kind === "text") {
    const clean = item.text.replace(/\s+/g, " ").trim();
    return clean.length > 0 ? clean : MESSAGE_ITEM_LABELS.text;
  }
  if (item.kind === "file" || item.kind === "audio") return mediaName(item) ?? MESSAGE_ITEM_LABELS[item.kind];
  return MESSAGE_ITEM_LABELS[item.kind];
}

/**
 * Nodo Mensaje cerrado: todos los bloques de contenido en su orden, sin tope
 * (el nodo existe para saber qué lleva sin abrirlo). Las pausas no se pintan:
 * no son algo que el cliente reciba. Solo presentación.
 */
export function MessageCompactBody({ draft }: ToolCompactProps) {
  const visible = readMessageItems(draft.config, draft.content).filter(isContent);

  if (visible.length === 0) {
    return <p className="flow-node__preview">{EMPTY_PREVIEW_TEXT}</p>;
  }

  return (
    <ul className="flow-node__blocks">
      {visible.map((item) => {
        const Icon = getItemIcon(item.kind);

        return (
          <li key={item.id} className={`flow-node__block flow-node__block--${item.kind}`}>
            {item.kind === "text" ? (
              <span className="flow-node__block-badge" aria-hidden="true">
                <Icon />
              </span>
            ) : (
              <MediaBlockThumbnail item={item} Icon={Icon} />
            )}
            <span className={`flow-node__block-text${item.kind !== "text" && (item.kind === "file" || item.kind === "audio") && mediaName(item) ? " flow-node__block-text--name" : ""}`}>{describe(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
