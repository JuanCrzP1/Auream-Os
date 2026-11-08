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

/**
 * Una línea por bloque: el texto escrito (normalizado a una fila) o, para un
 * medio, su TIPO. El nombre de archivo recortado no decía nada; lo que es el
 * archivo ya lo enseña la miniatura o el icono.
 */
function describe(item: ContentItem): string {
  if (item.kind === "text") {
    const clean = item.text.replace(/\s+/g, " ").trim();
    return clean.length > 0 ? clean : MESSAGE_ITEM_LABELS.text;
  }

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
            <span className="flow-node__block-text">{describe(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
