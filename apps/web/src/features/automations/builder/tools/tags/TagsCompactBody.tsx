import "../_kit/kit.css";
import type { ToolCompactProps } from "../ToolUi";
import { readTagsConfig } from "./tagsConfig";

const MAX_VISIBLE = 4;

/** Nodo cerrado: la acción y las etiquetas como chips. */
export function TagsCompactBody({ draft }: ToolCompactProps) {
  const { action, tags } = readTagsConfig(draft.config);

  if (tags.length === 0) return <p className="kit-node__empty">Sin etiquetas</p>;

  const hidden = tags.length - MAX_VISIBLE;
  return (
    <div className="kit-node">
      <span className="kit-node__eyebrow">{action === "add" ? "Agregar" : "Quitar"}</span>
      <ul className="kit-node__chips">
        {tags.slice(0, MAX_VISIBLE).map((tag) => (
          <li key={tag} className="kit-node__chip">
            <span aria-hidden="true">{action === "add" ? "+" : "−"}</span>
            {tag}
          </li>
        ))}
        {hidden > 0 ? <li className="kit-node__chip kit-node__chip--more">+{hidden}</li> : null}
      </ul>
    </div>
  );
}
