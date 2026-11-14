import "./meta-tag.css";
import { META_TAG_HINT } from "./metaSource";

/** La etiqueta «Meta» junto a un número que reporta Meta (no Auream). Igual en todo el producto. */
export function MetaTag({ tone = "light" }: { readonly tone?: "light" | "dark" }) {
  return (
    <span className={`meta-tag meta-tag--${tone}`} title={META_TAG_HINT} aria-label="según Meta">
      Meta
    </span>
  );
}
